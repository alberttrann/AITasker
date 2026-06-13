from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # LLM
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-4-6"
    llm_max_tokens: int = 4096

    # Confidence thresholds
    portfolio_eval_threshold: float = 0.85
    dispute_eval_threshold: float = 0.80

    # Service
    port: int = 8000
    env: str = "development"


settings = Settings()