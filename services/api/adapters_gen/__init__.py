"""Generation adapters package.

Re-exports the FAL and OpenAI Images sub-modules so callers can write::

    from adapters_gen import fal, openai_image
"""

from __future__ import annotations

from . import fal, openai_image

__all__ = ["fal", "openai_image"]
