from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    llm_api_key: str = ""
    anthropic_api_key: str = ""

    # DYNAMIC PROVIDER CONFIG
    llm_base_url:          str   = "https://generativelanguage.googleapis.com/v1beta/openai/"
    llm_model:             str   = "gemini-2.5-flash"
    llm_temperature:       float = 0.1
    llm_max_output_tokens: int   = 8192

    # Confidence thresholds
    portfolio_eval_threshold: float = 0.85
    dispute_eval_threshold:   float = 0.80

    # Service 
    port: int = 8000
    env:  str = "development"

    @property
    def active_api_key(self) -> str:
        return self.llm_api_key or self.anthropic_api_key

    @property
    def is_test_mode(self) -> bool:
        return not self.active_api_key or self.active_api_key.startswith("test")

settings = Settings()