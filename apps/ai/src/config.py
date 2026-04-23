from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://dermaos_app:password@localhost:5432/dermaos"
    ollama_base_url: str = "http://ollama:11434"
    ollama_default_model: str = "llama3.1:8b"
    ai_service_key: str = "change-me"
    debug: bool = False
    log_level: str = "info"


settings = Settings()
