"""
Prompt template service — DB-backed hot-reload with Jinja2 rendering.

Priority:
  1. DB record (fetched from NestJS /internal/prompts/:stage, cached 60s)
  2. .txt file on disk (fallback when no DB record exists)

Admin can update prompts via PUT /admin/prompts/:stage in NestJS.
Changes take effect within `prompt_cache_ttl_sec` seconds (default 60).

Jinja2 variables available in templates:
  For stage1_extract:
    {{ archetypes }}  — list of {code, name, description} from DB
    {{ void_codes }}  — list of {code, description}
  For stage5_synthesize:
    {{ domains }}     — list of {code, name} from DB
    {{ seams }}       — list of {code, name} from DB
    {{ archetypes }}  — list of {code, name, description} from DB
"""

import logging
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx
from jinja2 import BaseLoader, Environment, TemplateError

from app.config import settings

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

_jinja_env = Environment(loader=BaseLoader(), autoescape=False)
_jinja_env.filters["format_number"] = lambda x: f"{int(x):,}"

@dataclass
class _CacheEntry:
    text: str
    fetched_at: float = field(default_factory=time.monotonic)

    def is_stale(self) -> bool:
        return (time.monotonic() - self.fetched_at) > settings.prompt_cache_ttl_sec


_cache: dict[str, _CacheEntry] = {}


async def _fetch_from_nestjs(stage: str) -> str | None:
    """Call NestJS internal endpoint to get DB-stored template. Returns None on any failure."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                f"{settings.nestjs_base_url}/internal/prompts/{stage}",
                headers={"x-internal-token": settings.internal_service_token},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("templateText")
            # 404 = no DB record → fall back to file. Other errors → log and fall back.
            if resp.status_code != 404:
                logger.warning("NestJS prompt endpoint returned %s for stage=%s", resp.status_code, stage)
    except Exception as exc:
        logger.debug("Could not reach NestJS for prompt template (stage=%s): %s", stage, exc)
    return None


def _load_from_file(stage: str) -> str:
    """Load prompt from .txt file (canonical fallback)."""
    path = _PROMPTS_DIR / f"{stage}.txt"
    if not path.exists():
        raise FileNotFoundError(f"Prompt template not found: {path}")
    return path.read_text(encoding="utf-8").strip()


async def get_prompt_template(stage: str) -> str:
    """
    Return raw template text for a stage, respecting the TTL cache.
    DB record takes priority over .txt file.
    """
    entry = _cache.get(stage)
    if entry and not entry.is_stale():
        return entry.text

    # Cache miss or stale — try DB first, then file
    text = await _fetch_from_nestjs(stage)
    if text is None:
        logger.debug("No DB template for stage=%s, using .txt file", stage)
        text = _load_from_file(stage)
    else:
        logger.debug("Loaded DB template for stage=%s", stage)

    _cache[stage] = _CacheEntry(text=text)
    return text


def render_prompt(template_text: str, context: dict) -> str:
    """
    Render a Jinja2 template string with the given context dict.
    Falls back to returning the raw template_text if rendering fails.
    """
    if "{{" not in template_text and "{%" not in template_text:
        # No Jinja2 syntax — return as-is (avoids unnecessary parsing)
        return template_text
    try:
        template = _jinja_env.from_string(template_text)
        return template.render(**context)
    except TemplateError as exc:
        logger.warning("Jinja2 render error for template: %s. Using raw text.", exc)
        return template_text


async def get_rendered_prompt(stage: str, context: dict | None = None) -> str:
    """
    Convenience function: fetch template + render with context in one call.
    Most stage functions should use this instead of load_prompt().
    """
    template_text = await get_prompt_template(stage)
    return render_prompt(template_text, context or {})


def invalidate_cache(stage: str | None = None) -> None:
    """Force cache invalidation. Pass stage=None to clear all cached prompts."""
    if stage:
        _cache.pop(stage, None)
    else:
        _cache.clear()