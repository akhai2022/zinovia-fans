"""Vendored CatVTON pipeline (ICLR 2025).

Source: https://github.com/Zheng-Chong/CatVTON
License: Apache-2.0

Only the inference pipeline code is vendored here. Training utilities,
dataset loaders, and Gradio UI are omitted.
"""

from worker.ml.catvton.pipeline import CatVTONPipeline

__all__ = ["CatVTONPipeline"]
