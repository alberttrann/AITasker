"""Utility — loads prompt template files from app/prompts/."""

from pathlib import Path
from functools import lru_cache

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"


@lru_cache(maxsize=32)
def load_prompt(name: str) -> str:
    """
    Load and cache a prompt template.

    Args:
        name: filename without extension, e.g. "stage1_extract"

    Returns:
        File contents with leading/trailing whitespace stripped.
    """
    path = _PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text(encoding="utf-8").strip()