from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM — Google Gemini
    # Env var kept as ANTHROPIC_API_KEY so the team's .env files need no changes.
    # The value is a Gemini API key from aistudio.google.com.
    anthropic_api_key: str = ""

    # All LLM config is fully overridable via env vars — no hardcoding anywhere.
    llm_model:             str   = "gemini-2.5-flash"
    llm_temperature:       float = 0.1
    llm_max_output_tokens: int   = 8192

    # Confidence thresholds (match business rules)
    portfolio_eval_threshold: float = 0.85   # BR-VER-03
    dispute_eval_threshold:   float = 0.80   # BR-DIS-05

    # Service 
    port: int = 8000
    env:  str = "development"

    @property
    def gemini_api_key(self) -> str:
        """Alias used by llm_client.py — clearly signals the value is a Gemini key."""
        return self.anthropic_api_key

    @property
    def is_test_mode(self) -> bool:
        """True when running with a test/fake API key — used by integration tests."""
        return not self.anthropic_api_key or self.anthropic_api_key.startswith("test")


settings = Settings()