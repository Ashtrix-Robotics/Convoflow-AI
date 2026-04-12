from __future__ import annotations
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IntentCategory(str, Enum):
    new = "new"
    no_answer = "no_answer"
    not_interested = "not_interested"
    callback_requested = "callback_requested"
    interested = "interested"
    payment_pending = "payment_pending"
    future_planning = "future_planning"
    converted = "converted"
    wrong_number = "wrong_number"
    undecided = "undecided"


class LeadStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    in_progress = "in_progress"
    qualified = "qualified"
    payment_sent = "payment_sent"
    converted = "converted"
    lost = "lost"
    deferred = "deferred"


class CallTag(str, Enum):
    connected = "connected"
    no_answer = "no_answer"
    wrong_number = "wrong_number"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class AgentCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class AgentOut(BaseModel):
    id: str
    name: str
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SupabaseSessionIn(BaseModel):
    supabase_token: str


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class ClientCreate(BaseModel):
    name: str
    phone: str | None = None
    email: str | None = None
    company: str | None = None
    notes: str | None = None


class ClientOut(ClientCreate):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Lead
# ---------------------------------------------------------------------------

class LeadInbound(BaseModel):
    """Payload received from Pabbly when a new Google Sheets row is added."""
    model_config = ConfigDict(extra="allow")

    name: str
    phone: str
    email: str | None = None
    source_campaign: str | None = None
    ad_set: str | None = None
    google_sheet_row_id: str | None = None


class LeadCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    source_campaign: str | None = None
    ad_set: str | None = None
    notes: str | None = None
    extra_data: dict | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    source_campaign: str | None = None
    ad_set: str | None = None
    status: LeadStatus | None = None
    intent_category: IntentCategory | None = None
    notes: str | None = None
    conversation_summary: str | None = None
    extra_data: dict | None = None
    callback_scheduled_at: datetime | None = None
    next_followup_at: datetime | None = None
    course_interested_in: str | None = None
    payment_link_url: str | None = None
    assigned_agent_id: str | None = None


class LeadOut(BaseModel):
    id: str
    name: str
    phone: str
    email: str | None
    source_campaign: str | None
    ad_set: str | None
    google_sheet_row_id: str | None
    assigned_agent_id: str | None
    intent_category: str
    intent_confidence: float | None
    status: str
    callback_scheduled_at: datetime | None
    next_followup_at: datetime | None
    last_contacted_at: datetime | None
    followup_count: int
    payment_link_url: str | None
    payment_link_sent: bool
    interest_level: str | None
    course_interested_in: str | None
    objections: str | None
    notes: str | None
    conversation_summary: str | None
    extra_data: dict | None = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WhatsAppConversationSummaryOut(BaseModel):
    id: str
    lead_id: str
    phone_number: str
    status: str
    aisensy_contact_id: str | None
    initiation_source: str | None
    initiated_at: datetime | None
    first_user_message_at: datetime | None
    last_message_at: datetime | None
    last_sync_at: datetime | None
    is_automated: bool
    is_intervened: bool
    is_closed: bool
    opted_out: bool
    last_inbound_message_preview: str | None
    last_outbound_message_preview: str | None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class WhatsAppMessageOut(BaseModel):
    id: str
    aisensy_message_id: str | None
    direction: str
    sender_type: str | None
    message_type: str | None
    status: str
    content: str | None
    template_name: str | None
    campaign_name: str | None
    failure_reason: str | None
    sent_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WhatsAppMessageListOut(BaseModel):
    total: int
    count: int
    skip: int
    limit: int
    has_more: bool
    messages: list[WhatsAppMessageOut]


class WhatsAppMessageSendIn(BaseModel):
    message_type: str = "template"
    template_name: str | None = None
    template_params: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Call Record
# ---------------------------------------------------------------------------

class CallRecordOut(BaseModel):
    id: str
    agent_id: str
    client_id: str | None
    lead_id: str | None
    duration_seconds: int | None
    status: str
    transcription: str | None
    summary: str | None
    action_items: str | None
    intent_category: str | None
    intent_confidence: float | None
    sentiment: str | None
    call_tag: str | None
    pabbly_sent: bool
    recorded_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class CallLeadLinkIn(BaseModel):
    lead_id: str | None = None


# ---------------------------------------------------------------------------
# Follow Up
# ---------------------------------------------------------------------------

class FollowUpCreate(BaseModel):
    task: str
    due_date: datetime | None = None


class FollowUpOut(FollowUpCreate):
    id: str
    call_id: str
    status: str
    pabbly_triggered: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class AnalyticsOverview(BaseModel):
    total_leads: int
    leads_by_status: dict[str, int]
    leads_by_intent: dict[str, int]
    leads_by_campaign: dict[str, int]
    # Array versions of the dicts above — pre-shaped for chart consumption
    campaign_breakdown: list[dict] = []   # [{campaign, leads, converted, conversion_rate}, ...]
    intent_distribution: list[dict] = []  # [{intent, count}, ...]
    daily_stats: list[dict] = []          # [{date, new_leads, calls_made, conversions}, ...]
    total_calls_today: int
    total_conversions: int
    conversion_rate: float
    agent_stats: list[dict]
    # Enhanced analytics fields
    stale_leads_count: int = 0           # Leads not contacted in 7+ days (status=new/contacted)
    followups_due_today: int = 0         # Leads with next_followup_at == today
    leads_without_contact: int = 0       # New leads never contacted
    whatsapp_active_count: int = 0       # Active WhatsApp conversations
    avg_followup_count: float = 0.0      # Avg followup_count across all leads
    status_funnel: list[dict] = []       # [{stage, count, pct}] ordered pipeline stages


# ---------------------------------------------------------------------------
# Bulk Lead Operations
# ---------------------------------------------------------------------------

class BulkLeadAction(BaseModel):
    lead_ids: list[str]
    action: str                          # "change_status"|"change_intent"|"assign"|"delete"
    status: LeadStatus | None = None
    intent_category: IntentCategory | None = None
    agent_id: str | None = None


class BulkLeadResult(BaseModel):
    updated: int
    deleted: int
    failed: int
    errors: list[str] = []
