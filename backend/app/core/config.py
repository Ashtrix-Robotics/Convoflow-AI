from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    secret_key: str = "change-this-in-production"
    debug: bool = False

    @model_validator(mode="after")
    def _check_secret_key(self) -> "Settings":
        if (
            self.environment == "production"
            and self.secret_key == "change-this-in-production"
        ):
            raise ValueError(
                "SECRET_KEY must be set to a random value in production. "
                "Run: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self

    # ---------------------------------------------------------------------------
    # AI — Transcription (Groq Whisper) + LLM (DeepSeek V3)
    # ---------------------------------------------------------------------------
    # Groq: free-tier Whisper, multilingual (Tamil + English supported)
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_whisper_model: str = "whisper-large-v3-turbo"

    # DeepSeek V3: ultra-low-cost LLM for intent extraction
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_chat_model: str = "deepseek-chat"
    deepseek_temperature: float = 0.1

    # Fallback: Vercel AI Gateway (used if Groq/DeepSeek keys are absent)
    ai_gateway_api_key: str = ""
    ai_gateway_base_url: str = "https://ai-gateway.vercel.sh/v1"
    ai_gateway_whisper_model: str = "whisper-1"
    ai_gateway_chat_model: str = "gpt-4o-mini"
    ai_gateway_temperature: float = 0.1

    # ---------------------------------------------------------------------------
    # Supabase
    # ---------------------------------------------------------------------------
    supabase_url: str = ""
    supabase_service_key: str = ""   # service_role key (backend only — never expose to frontend)
    supabase_anon_key: str = ""
    supabase_bucket: str = "recordings"

    # ---------------------------------------------------------------------------
    # Pabbly Connect
    # ---------------------------------------------------------------------------
    pabbly_webhook_url: str = ""
    pabbly_secret_key: str = ""

    # ---------------------------------------------------------------------------
    # AiSensy / WhatsApp
    # ---------------------------------------------------------------------------
    aisensy_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("AISENSY_API_KEY", "API_CAMPAIGN_KEY"),
    )
    aisensy_project_id: str = ""
    # Project API password (from AiSensy dashboard → Manage → Project API)
    # Used for sending conversational (session) messages via Project API
    aisensy_project_api_pwd: str = ""
    aisensy_project_api_url: str = "https://apis.aisensy.com/project-apis/v1/project"
    aisensy_campaign_url: str = "https://backend.aisensy.com/campaign/t1/api/v2"
    aisensy_lookup_url: str = ""
    aisensy_lookup_method: str = "GET"
    aisensy_webhook_secret: str = ""
    aisensy_first_campaign_name: str = ""
    aisensy_send_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("AISENSY_SEND_ENABLED", "WHATSAPP_SEND_APPROVED"),
    )
    aisensy_default_country_code: str = "91"
    aisensy_request_timeout_seconds: float = 15.0

    # ---------------------------------------------------------------------------
    # Database
    # ---------------------------------------------------------------------------
    # Default: SQLite for local dev. Override with PostgreSQL URL in production.
    database_url: str = "sqlite:///./convoflow.db"

    # ---------------------------------------------------------------------------
    # File storage fallback (used only when Supabase storage is unavailable)
    # ---------------------------------------------------------------------------
    upload_dir: str = "uploads"
    max_audio_size_mb: int = 100

    # ---------------------------------------------------------------------------
    # JWT / Auth
    # ---------------------------------------------------------------------------
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    jwt_algorithm: str = "HS256"

    # ---------------------------------------------------------------------------
    # CORS
    # ---------------------------------------------------------------------------
    allowed_origins: str = "http://localhost:5173,http://localhost:3000,https://convoflow-web.vercel.app"

    # ---------------------------------------------------------------------------
    # App meta
    # ---------------------------------------------------------------------------
    app_title: str = "Convoflow AI API — EduTech Edition"
    app_description: str = "Backend for call transcription, lead intent classification, and Pabbly automation."
    app_version: str = "1.0.0"

    # ---------------------------------------------------------------------------
    # Google Sheets — lead sync
    # ---------------------------------------------------------------------------
    # JSON string of the service account credentials (from GCP → create service account key)
    google_service_account_json: str = ""
    # The ID of the Google Spreadsheet (from the URL: /spreadsheets/d/<ID>/edit)
    google_spreadsheet_id: str = ""
    # Name of the source worksheet tab where inbound leads live (from Meta ads sheet)
    # This is the tab Pabbly watches. Leave blank to use 'Sheet1'.
    google_source_sheet_name: str = ""

    @property
    def use_google_sheets(self) -> bool:
        return bool(self.google_service_account_json and self.google_spreadsheet_id)

    # ---------------------------------------------------------------------------
    # Razorpay (Phase 2)
    # ---------------------------------------------------------------------------
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    # ---------------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------------
    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    @property
    def use_groq(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def use_deepseek(self) -> bool:
        return bool(self.deepseek_api_key)

    @property
    def use_supabase_storage(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def use_aisensy(self) -> bool:
        return bool(self.aisensy_api_key)

    @property
    def use_aisensy_lookup(self) -> bool:
        return bool(self.use_aisensy and self.aisensy_lookup_url)

    @property
    def use_aisensy_campaigns(self) -> bool:
        return bool(self.use_aisensy and self.aisensy_first_campaign_name)

    @property
    def use_aisensy_project_api(self) -> bool:
        """True when Project API credentials are present — enables session (conversational) messaging."""
        return bool(self.aisensy_project_id and self.aisensy_project_api_pwd)

    @property
    def allow_aisensy_outbound(self) -> bool:
        """True when API key is present AND sending has been explicitly approved."""
        return bool(self.use_aisensy and self.aisensy_send_enabled)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
