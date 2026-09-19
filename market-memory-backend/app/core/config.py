from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    openrouter_api_key: str | None = None
    openrouter_model: str = "openrouter/free"
    ai_requests_per_minute: int = 6
    ai_context_entries: int = 20
    mcp_public_url: str | None = None
    mcp_allowed_hosts: str = "localhost,127.0.0.1"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def mcp_allowed_host_list(self) -> list[str]:
        return [item.strip() for item in self.mcp_allowed_hosts.split(",") if item.strip()]


settings = Settings()
