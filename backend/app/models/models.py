import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Canonical UTC timestamp default â€” avoids datetime.utcnow() deprecation (Python 3.12+)
_utcnow = lambda: datetime.now(timezone.utc)  # noqa: E731


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    supabase_uid: Mapped[Optional[str]] = mapped_column(String(36), unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    calls: Mapped[List["CallRecord"]] = relationship("CallRecord", back_populates="agent")
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="assigned_agent")


# ---------------------------------------------------------------------------
# Client  (kept for backward compat â€” new leads use Lead model)
# ---------------------------------------------------------------------------

class Client(Base):
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    company: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    calls: Mapped[List["CallRecord"]] = relationship("CallRecord", back_populates="client")


# ---------------------------------------------------------------------------
# Lead  (EduTech sales pipeline)
# ---------------------------------------------------------------------------
# intent_category values:
#   new | no_answer | not_interested | callback_requested | interested
#   | payment_pending | future_planning | converted | wrong_number | undecided
#
# status values:
#   new | contacted | in_progress | qualified | payment_sent
#   | converted | lost | deferred

class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))

    # Contact info
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))

    # Acquisition / source
    source_campaign: Mapped[Optional[str]] = mapped_column(String(255))
    ad_set: Mapped[Optional[str]] = mapped_column(String(255))
    google_sheet_row_id: Mapped[Optional[str]] = mapped_column(String(100))

    # Assignment
    assigned_agent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("agents.id"))

    # AI-classified intent
    intent_category: Mapped[str] = mapped_column(String(40), default="new", index=True)
    intent_confidence: Mapped[Optional[float]] = mapped_column(Float)

    # Pipeline status
    status: Mapped[str] = mapped_column(String(30), default="new", index=True)

    # Scheduling
    callback_scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    next_followup_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_contacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    followup_count: Mapped[int] = mapped_column(Integer, default=0)

    # Payment
    payment_link_url: Mapped[Optional[str]] = mapped_column(String(500))
    payment_link_sent: Mapped[bool] = mapped_column(default=False)

    # Miscellaneous
    interest_level: Mapped[Optional[str]] = mapped_column(String(20))       # high|medium|low|none
    course_interested_in: Mapped[Optional[str]] = mapped_column(String(255))
    objections: Mapped[Optional[str]] = mapped_column(Text)                # JSON array stored as text
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    assigned_agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="leads")
    calls: Mapped[List["CallRecord"]] = relationship("CallRecord", back_populates="lead")
    whatsapp_conversation: Mapped[Optional["WhatsAppConversation"]] = relationship(
        "WhatsAppConversation",
        back_populates="lead",
        uselist=False,
    )


# ---------------------------------------------------------------------------
# Call Record
# ---------------------------------------------------------------------------

class CallRecord(Base):
    __tablename__ = "call_records"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), nullable=False)
    client_id: Mapped[Optional[str]] = mapped_column(ForeignKey("clients.id"))
    lead_id: Mapped[Optional[str]] = mapped_column(ForeignKey("leads.id"), index=True)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String(500))  # local path or Supabase storage key
    audio_url: Mapped[Optional[str]] = mapped_column(String(1000))       # public Supabase URL
    audio_storage_backend: Mapped[Optional[str]] = mapped_column(String(20), default="local")  # supabase|local
    duration_seconds: Mapped[Optional[int]] = mapped_column()
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # status: pending | transcribing | completed | failed
    transcription: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    action_items: Mapped[Optional[str]] = mapped_column(Text)  # JSON string
    # AI intent (denormalized from Lead for quick access)
    intent_category: Mapped[Optional[str]] = mapped_column(String(40))
    intent_confidence: Mapped[Optional[float]] = mapped_column(Float)
    sentiment: Mapped[Optional[str]] = mapped_column(String(20))
    pabbly_sent: Mapped[bool] = mapped_column(default=False)
    call_tag: Mapped[Optional[str]] = mapped_column(String(30))  # connected | no_answer | wrong_number
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    agent: Mapped["Agent"] = relationship("Agent", back_populates="calls")
    client: Mapped[Optional["Client"]] = relationship("Client", back_populates="calls")
    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="calls")
    followups: Mapped[List["FollowUp"]] = relationship("FollowUp", back_populates="call")
    whatsapp_messages: Mapped[List["WhatsAppMessage"]] = relationship(
        "WhatsAppMessage",
        back_populates="related_call",
    )


# ---------------------------------------------------------------------------
# Follow Up
# ---------------------------------------------------------------------------

class FollowUp(Base):
    __tablename__ = "followups"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    call_id: Mapped[str] = mapped_column(ForeignKey("call_records.id"), nullable=False)
    task: Mapped[str] = mapped_column(Text, nullable=False)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    # status: pending | completed | dismissed
    pabbly_triggered: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    call: Mapped["CallRecord"] = relationship("CallRecord", back_populates="followups")


# ---------------------------------------------------------------------------
# WhatsApp / AiSensy
# ---------------------------------------------------------------------------

class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), nullable=False, unique=True, index=True)
    aisensy_contact_id: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    phone_number: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="lookup_pending", index=True)
    initiated_by_agent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("agents.id"))
    initiation_source: Mapped[Optional[str]] = mapped_column(String(30), default="lead_import")
    initiated_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    first_user_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_message_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    sync_cursor: Mapped[Optional[str]] = mapped_column(String(255))
    is_automated: Mapped[bool] = mapped_column(Boolean, default=False)
    is_intervened: Mapped[bool] = mapped_column(Boolean, default=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False)
    opted_out: Mapped[bool] = mapped_column(Boolean, default=False)
    last_inbound_message_preview: Mapped[Optional[str]] = mapped_column(Text)
    last_outbound_message_preview: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    lead: Mapped["Lead"] = relationship("Lead", back_populates="whatsapp_conversation")
    initiated_by_agent: Mapped[Optional["Agent"]] = relationship("Agent")
    messages: Mapped[List["WhatsAppMessage"]] = relationship(
        "WhatsAppMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id: Mapped[str] = mapped_column(ForeignKey("whatsapp_conversations.id"), nullable=False, index=True)
    aisensy_message_id: Mapped[Optional[str]] = mapped_column(String(120), unique=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    sender_type: Mapped[Optional[str]] = mapped_column(String(20))
    message_type: Mapped[Optional[str]] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    content: Mapped[Optional[str]] = mapped_column(Text)
    template_name: Mapped[Optional[str]] = mapped_column(String(120))
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255))
    failure_reason: Mapped[Optional[str]] = mapped_column(Text)
    raw_payload: Mapped[Optional[str]] = mapped_column(Text)
    related_call_id: Mapped[Optional[str]] = mapped_column(ForeignKey("call_records.id"))
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    conversation: Mapped["WhatsAppConversation"] = relationship("WhatsAppConversation", back_populates="messages")
    related_call: Mapped[Optional["CallRecord"]] = relationship("CallRecord", back_populates="whatsapp_messages")


class AisensyWebhookEvent(Base):
    __tablename__ = "aisensy_webhook_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    topic: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(120))
    delivery_attempt: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="received", index=True)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)


# ---------------------------------------------------------------------------
# Admin: Application Settings (key-value store)
# ---------------------------------------------------------------------------

class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[Optional[str]] = mapped_column(Text)
    updated_by_agent_id: Mapped[Optional[str]] = mapped_column(ForeignKey("agents.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


# ---------------------------------------------------------------------------
# Admin: Campaign Knowledge Base
# ---------------------------------------------------------------------------

class CampaignKnowledge(Base):
    __tablename__ = "campaign_knowledge"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    # Must match the AiSensy campaign name exactly
    aisensy_campaign_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    # Template variable support — JSON: [{"label":"Name","example":"Sreenath"}]
    template_params_schema_json: Mapped[Optional[str]] = mapped_column(Text)
    # JSON array of default param values sent with every campaign: ["Sreenath","Summer Camp"]
    default_template_params_json: Mapped[Optional[str]] = mapped_column(Text)

    # Product / service knowledge for AI
    product_name: Mapped[Optional[str]] = mapped_column(String(255))
    product_description: Mapped[Optional[str]] = mapped_column(Text)
    key_selling_points: Mapped[Optional[str]] = mapped_column(Text)
    pricing_info: Mapped[Optional[str]] = mapped_column(Text)
    target_audience: Mapped[Optional[str]] = mapped_column(Text)
    # Tone: friendly | professional | casual | energetic
    tone: Mapped[str] = mapped_column(String(30), default="friendly")
    # System-prompt snippet inserted when AI replies
    ai_persona_prompt: Mapped[Optional[str]] = mapped_column(Text)
    # JSON array: [{"question":"...", "answer":"..."}]
    faq_json: Mapped[Optional[str]] = mapped_column(Text)
    # JSON array: [{"objection":"...", "handling":"..."}]
    objections_json: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

