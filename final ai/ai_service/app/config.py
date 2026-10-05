from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")
    database_url: str  # Required — must be set in .env
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    llm_model: str = "gemini-3.8-flash"
    embed_model: str = "BAAI/bge-small-en-v1.5"

settings = Settings()