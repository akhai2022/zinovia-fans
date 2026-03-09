"""CatVTON utility functions (vendored).

Source: https://github.com/Zheng-Chong/CatVTON/blob/main/utils.py
       https://github.com/Zheng-Chong/CatVTON/blob/main/model/utils.py

Only the functions needed for inference are included.
"""

from __future__ import annotations

import numpy as np
import PIL
import torch
from PIL import Image

from worker.ml.catvton.attn_processor import AttnProcessor2_0, SkipAttnProcessor


# ── Model utilities (from model/utils.py) ────────────────────────────


def init_adapter(
    unet,
    cross_attn_cls=SkipAttnProcessor,
    self_attn_cls=None,
    cross_attn_dim=None,
    **kwargs,
):
    """Replace UNet attention processors with CatVTON's skip-attention."""
    if cross_attn_dim is None:
        cross_attn_dim = unet.config.cross_attention_dim
    attn_procs = {}
    for name in unet.attn_processors.keys():
        cross_attention_dim = (
            None if name.endswith("attn1.processor") else cross_attn_dim
        )
        if name.startswith("mid_block"):
            hidden_size = unet.config.block_out_channels[-1]
        elif name.startswith("up_blocks"):
            block_id = int(name[len("up_blocks.")])
            hidden_size = list(reversed(unet.config.block_out_channels))[block_id]
        elif name.startswith("down_blocks"):
            block_id = int(name[len("down_blocks.")])
            hidden_size = unet.config.block_out_channels[block_id]
        if cross_attention_dim is None:
            if self_attn_cls is not None:
                attn_procs[name] = self_attn_cls(
                    hidden_size=hidden_size,
                    cross_attention_dim=cross_attention_dim,
                    **kwargs,
                )
            else:
                attn_procs[name] = AttnProcessor2_0(
                    hidden_size=hidden_size,
                    cross_attention_dim=cross_attention_dim,
                    **kwargs,
                )
        else:
            attn_procs[name] = cross_attn_cls(
                hidden_size=hidden_size,
                cross_attention_dim=cross_attention_dim,
                **kwargs,
            )

    unet.set_attn_processor(attn_procs)
    adapter_modules = torch.nn.ModuleList(unet.attn_processors.values())
    return adapter_modules


def get_trainable_module(unet, trainable_module_name):
    """Extract named module groups from UNet for checkpoint loading."""
    if trainable_module_name == "attention":
        attn_blocks = torch.nn.ModuleList()
        for name, param in unet.named_modules():
            if "attn1" in name:
                attn_blocks.append(param)
        return attn_blocks
    raise ValueError(f"Unknown trainable_module_name: {trainable_module_name}")


# ── Image utilities (from utils.py) ──────────────────────────────────


def compute_vae_encodings(image: torch.Tensor, vae: torch.nn.Module) -> torch.Tensor:
    """Encode image tensor to VAE latent space."""
    pixel_values = image.to(memory_format=torch.contiguous_format).float()
    pixel_values = pixel_values.to(vae.device, dtype=vae.dtype)
    with torch.no_grad():
        model_input = vae.encode(pixel_values).latent_dist.sample()
    model_input = model_input * vae.config.scaling_factor
    return model_input


def numpy_to_pil(images):
    """Convert numpy image array (0-1 float) to list of PIL Images."""
    if images.ndim == 3:
        images = images[None, ...]
    images = (images * 255).round().astype("uint8")
    if images.shape[-1] == 1:
        pil_images = [Image.fromarray(image.squeeze(), mode="L") for image in images]
    else:
        pil_images = [Image.fromarray(image) for image in images]
    return pil_images


def prepare_image(image):
    """Convert PIL Image to normalized tensor ([-1, 1])."""
    if isinstance(image, torch.Tensor):
        if image.ndim == 3:
            image = image.unsqueeze(0)
        image = image.to(dtype=torch.float32)
    else:
        if isinstance(image, (PIL.Image.Image, np.ndarray)):
            image = [image]
        if isinstance(image, list) and isinstance(image[0], PIL.Image.Image):
            image = [np.array(i.convert("RGB"))[None, :] for i in image]
            image = np.concatenate(image, axis=0)
        elif isinstance(image, list) and isinstance(image[0], np.ndarray):
            image = np.concatenate([i[None, :] for i in image], axis=0)
        image = image.transpose(0, 3, 1, 2)
        image = torch.from_numpy(image).to(dtype=torch.float32) / 127.5 - 1.0
    return image


def prepare_mask_image(mask_image):
    """Convert PIL mask to binary tensor (0 or 1)."""
    if isinstance(mask_image, torch.Tensor):
        if mask_image.ndim == 2:
            mask_image = mask_image.unsqueeze(0).unsqueeze(0)
        elif mask_image.ndim == 3 and mask_image.shape[0] == 1:
            mask_image = mask_image.unsqueeze(0)
        elif mask_image.ndim == 3 and mask_image.shape[0] != 1:
            mask_image = mask_image.unsqueeze(1)
        mask_image[mask_image < 0.5] = 0
        mask_image[mask_image >= 0.5] = 1
    else:
        if isinstance(mask_image, (PIL.Image.Image, np.ndarray)):
            mask_image = [mask_image]
        if isinstance(mask_image, list) and isinstance(
            mask_image[0], PIL.Image.Image
        ):
            mask_image = np.concatenate(
                [np.array(m.convert("L"))[None, None, :] for m in mask_image], axis=0
            )
            mask_image = mask_image.astype(np.float32) / 255.0
        elif isinstance(mask_image, list) and isinstance(mask_image[0], np.ndarray):
            mask_image = np.concatenate(
                [m[None, None, :] for m in mask_image], axis=0
            )
        mask_image[mask_image < 0.5] = 0
        mask_image[mask_image >= 0.5] = 1
        mask_image = torch.from_numpy(mask_image)
    return mask_image


def resize_and_crop(image, size):
    """Resize and center-crop image to target size, preserving aspect ratio."""
    w, h = image.size
    target_w, target_h = size
    if w / h < target_w / target_h:
        new_w = w
        new_h = w * target_h // target_w
    else:
        new_h = h
        new_w = h * target_w // target_h
    image = image.crop(
        ((w - new_w) // 2, (h - new_h) // 2, (w + new_w) // 2, (h + new_h) // 2)
    )
    image = image.resize(size, Image.LANCZOS)
    return image


def resize_and_padding(image, size):
    """Resize image to fit within target size, padding with white."""
    w, h = image.size
    target_w, target_h = size
    if w / h < target_w / target_h:
        new_h = target_h
        new_w = w * target_h // h
    else:
        new_w = target_w
        new_h = h * target_w // w
    image = image.resize((new_w, new_h), Image.LANCZOS)
    padding = Image.new("RGB", size, (255, 255, 255))
    padding.paste(image, ((target_w - new_w) // 2, (target_h - new_h) // 2))
    return padding
