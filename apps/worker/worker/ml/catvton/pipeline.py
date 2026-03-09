"""CatVTON inference pipeline (vendored).

Source: https://github.com/Zheng-Chong/CatVTON/blob/main/model/pipeline.py

CatVTON (ICLR 2025) — Concatenation Is All You Need for Virtual Try-On.
Uses latent-space concatenation of person + garment with SD inpainting UNet,
replacing cross-attention with skip-attention. No text encoder needed.

Models:
  - stabilityai/sd-vae-ft-mse (~330MB VAE)
  - runwayml/stable-diffusion-inpainting (~2GB UNet + scheduler)
  - zhengchong/CatVTON (~50MB attention checkpoint)
"""

from __future__ import annotations

import inspect
import os
from typing import Union

import numpy as np
import PIL
import torch
import tqdm
from accelerate import load_checkpoint_in_model
from diffusers import AutoencoderKL, DDIMScheduler, UNet2DConditionModel
from diffusers.utils.torch_utils import randn_tensor
from huggingface_hub import snapshot_download

from worker.ml.catvton.attn_processor import SkipAttnProcessor
from worker.ml.catvton.utils import (
    compute_vae_encodings,
    get_trainable_module,
    init_adapter,
    numpy_to_pil,
    prepare_image,
    prepare_mask_image,
    resize_and_crop,
    resize_and_padding,
)


class CatVTONPipeline:
    """CatVTON virtual try-on pipeline.

    Architecture:
      - SD 1.5 inpainting UNet with cross-attention replaced by skip-attention
      - Garment conditioning via latent concatenation along height axis
      - DDIM scheduler for denoising
      - No text encoder (cross-attention is skipped entirely)

    Args:
        base_ckpt: HuggingFace model ID for SD inpainting base
                   (default: "runwayml/stable-diffusion-inpainting")
        attn_ckpt: HuggingFace model ID or local path for CatVTON attention weights
                   (default: "zhengchong/CatVTON")
        attn_ckpt_version: Which checkpoint variant — "mix", "vitonhd", or "dresscode"
        weight_dtype: Torch dtype for model weights
        device: "cpu" or "cuda"
        skip_safety_check: If True, skip NSFW safety checker
        use_tf32: Enable TF32 on Ampere GPUs (ignored on CPU)
    """

    def __init__(
        self,
        base_ckpt: str,
        attn_ckpt: str,
        attn_ckpt_version: str = "mix",
        weight_dtype=torch.float32,
        device: str = "cuda",
        skip_safety_check: bool = True,
        use_tf32: bool = True,
    ):
        self.device = device
        self.weight_dtype = weight_dtype
        self.skip_safety_check = skip_safety_check

        self.noise_scheduler = DDIMScheduler.from_pretrained(
            base_ckpt, subfolder="scheduler"
        )
        self.vae = AutoencoderKL.from_pretrained("stabilityai/sd-vae-ft-mse").to(
            device, dtype=weight_dtype
        )
        self.unet = UNet2DConditionModel.from_pretrained(
            base_ckpt, subfolder="unet"
        ).to(device, dtype=weight_dtype)

        # Replace cross-attention with skip-attention
        init_adapter(self.unet, cross_attn_cls=SkipAttnProcessor)
        self.attn_modules = get_trainable_module(self.unet, "attention")

        # Load CatVTON attention checkpoint
        self._load_attn_ckpt(attn_ckpt, attn_ckpt_version)

        if use_tf32 and device != "cpu":
            torch.set_float32_matmul_precision("high")
            torch.backends.cuda.matmul.allow_tf32 = True

    def _load_attn_ckpt(self, attn_ckpt: str, version: str) -> None:
        """Download (if needed) and load the CatVTON attention weights."""
        sub_folder = {
            "mix": "mix-48k-1024",
            "vitonhd": "vitonhd-16k-512",
            "dresscode": "dresscode-16k-512",
        }[version]

        if os.path.exists(attn_ckpt):
            ckpt_path = os.path.join(attn_ckpt, sub_folder, "attention")
        else:
            repo_path = snapshot_download(repo_id=attn_ckpt)
            ckpt_path = os.path.join(repo_path, sub_folder, "attention")

        load_checkpoint_in_model(self.attn_modules, ckpt_path)

    def _prepare_extra_step_kwargs(self, generator, eta):
        accepts_eta = "eta" in set(
            inspect.signature(self.noise_scheduler.step).parameters.keys()
        )
        extra_step_kwargs = {}
        if accepts_eta:
            extra_step_kwargs["eta"] = eta

        accepts_generator = "generator" in set(
            inspect.signature(self.noise_scheduler.step).parameters.keys()
        )
        if accepts_generator:
            extra_step_kwargs["generator"] = generator
        return extra_step_kwargs

    @torch.no_grad()
    def __call__(
        self,
        image: Union[PIL.Image.Image, torch.Tensor],
        condition_image: Union[PIL.Image.Image, torch.Tensor],
        mask: Union[PIL.Image.Image, torch.Tensor],
        num_inference_steps: int = 50,
        guidance_scale: float = 2.5,
        height: int = 1024,
        width: int = 768,
        generator=None,
        eta: float = 1.0,
        **kwargs,
    ) -> list[PIL.Image.Image]:
        """Run virtual try-on inference.

        Args:
            image: Person photo (PIL Image or tensor).
            condition_image: Garment image (PIL Image or tensor).
            mask: Binary mask — white (255) = region to replace.
            num_inference_steps: DDIM denoising steps.
            guidance_scale: Classifier-free guidance scale.
            height: Output height in pixels.
            width: Output width in pixels.
            generator: Optional torch.Generator for reproducibility.
            eta: DDIM eta parameter.

        Returns:
            List of PIL Images (typically length 1).
        """
        concat_dim = -2  # Concatenate along height (y-axis)

        # Prepare inputs — resize/crop to target dimensions
        image, condition_image, mask = self._check_inputs(
            image, condition_image, mask, width, height
        )
        image = prepare_image(image).to(self.device, dtype=self.weight_dtype)
        condition_image = prepare_image(condition_image).to(
            self.device, dtype=self.weight_dtype
        )
        mask = prepare_mask_image(mask).to(self.device, dtype=self.weight_dtype)

        # Mask the person image
        masked_image = image * (mask < 0.5)

        # VAE encode
        masked_latent = compute_vae_encodings(masked_image, self.vae)
        condition_latent = compute_vae_encodings(condition_image, self.vae)
        mask_latent = torch.nn.functional.interpolate(
            mask, size=masked_latent.shape[-2:], mode="nearest"
        )

        del image, mask, condition_image

        # Concatenate person + garment latents along height
        masked_latent_concat = torch.cat(
            [masked_latent, condition_latent], dim=concat_dim
        )
        mask_latent_concat = torch.cat(
            [mask_latent, torch.zeros_like(mask_latent)], dim=concat_dim
        )

        # Prepare noise
        latents = randn_tensor(
            masked_latent_concat.shape,
            generator=generator,
            device=masked_latent_concat.device,
            dtype=self.weight_dtype,
        )

        # Set up timesteps
        self.noise_scheduler.set_timesteps(num_inference_steps, device=self.device)
        timesteps = self.noise_scheduler.timesteps
        latents = latents * self.noise_scheduler.init_noise_sigma

        # Classifier-Free Guidance setup
        do_cfg = guidance_scale > 1.0
        if do_cfg:
            masked_latent_concat = torch.cat(
                [
                    torch.cat(
                        [masked_latent, torch.zeros_like(condition_latent)],
                        dim=concat_dim,
                    ),
                    masked_latent_concat,
                ]
            )
            mask_latent_concat = torch.cat([mask_latent_concat] * 2)

        # Denoising loop
        extra_step_kwargs = self._prepare_extra_step_kwargs(generator, eta)
        num_warmup_steps = (
            len(timesteps) - num_inference_steps * self.noise_scheduler.order
        )

        with tqdm.tqdm(total=num_inference_steps) as progress_bar:
            for i, t in enumerate(timesteps):
                latent_model_input = (
                    torch.cat([latents] * 2) if do_cfg else latents
                )
                latent_model_input = self.noise_scheduler.scale_model_input(
                    latent_model_input, t
                )

                # Inpainting input: [latents, mask, masked_condition]
                inpainting_input = torch.cat(
                    [latent_model_input, mask_latent_concat, masked_latent_concat],
                    dim=1,
                )

                noise_pred = self.unet(
                    inpainting_input,
                    t.to(self.device),
                    encoder_hidden_states=None,
                    return_dict=False,
                )[0]

                # Apply CFG
                if do_cfg:
                    noise_pred_uncond, noise_pred_cond = noise_pred.chunk(2)
                    noise_pred = noise_pred_uncond + guidance_scale * (
                        noise_pred_cond - noise_pred_uncond
                    )

                # DDIM step
                latents = self.noise_scheduler.step(
                    noise_pred, t, latents, **extra_step_kwargs
                ).prev_sample

                if i == len(timesteps) - 1 or (
                    (i + 1) > num_warmup_steps
                    and (i + 1) % self.noise_scheduler.order == 0
                ):
                    progress_bar.update()

        # Decode — take only the person half (discard garment concat)
        latents = latents.split(latents.shape[concat_dim] // 2, dim=concat_dim)[0]
        latents = 1 / self.vae.config.scaling_factor * latents
        decoded = self.vae.decode(
            latents.to(self.device, dtype=self.weight_dtype)
        ).sample
        decoded = (decoded / 2 + 0.5).clamp(0, 1)

        image_np = decoded.cpu().permute(0, 2, 3, 1).float().numpy()
        return numpy_to_pil(image_np)

    def _check_inputs(self, image, condition_image, mask, width, height):
        """Validate and resize inputs."""
        if (
            isinstance(image, torch.Tensor)
            and isinstance(condition_image, torch.Tensor)
            and isinstance(mask, torch.Tensor)
        ):
            return image, condition_image, mask
        image = resize_and_crop(image, (width, height))
        mask = resize_and_crop(mask, (width, height))
        condition_image = resize_and_padding(condition_image, (width, height))
        return image, condition_image, mask
