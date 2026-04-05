"""add_whatsapp_tables

Revision ID: 59713e9a1ac7
Revises: 154543e33e0e
Create Date: 2026-04-05 19:38:37.102917

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59713e9a1ac7'
down_revision: Union[str, None] = '154543e33e0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'whatsapp_conversations' not in existing_tables:
        op.create_table(
            'whatsapp_conversations',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('lead_id', sa.String, sa.ForeignKey('leads.id'), nullable=False, unique=True),
            sa.Column('aisensy_contact_id', sa.String(120), nullable=True, unique=True),
            sa.Column('phone_number', sa.String(30), nullable=False),
            sa.Column('status', sa.String(40), nullable=False, server_default='lookup_pending'),
            sa.Column('initiated_by_agent_id', sa.String, sa.ForeignKey('agents.id'), nullable=True),
            sa.Column('initiation_source', sa.String(30), nullable=True, server_default='lead_import'),
            sa.Column('initiated_at', sa.DateTime, nullable=True),
            sa.Column('first_user_message_at', sa.DateTime, nullable=True),
            sa.Column('last_message_at', sa.DateTime, nullable=True),
            sa.Column('last_sync_at', sa.DateTime, nullable=True),
            sa.Column('sync_cursor', sa.String(255), nullable=True),
            sa.Column('is_automated', sa.Boolean, nullable=False, server_default='false'),
            sa.Column('is_intervened', sa.Boolean, nullable=False, server_default='false'),
            sa.Column('is_closed', sa.Boolean, nullable=False, server_default='false'),
            sa.Column('opted_out', sa.Boolean, nullable=False, server_default='false'),
            sa.Column('last_inbound_message_preview', sa.Text, nullable=True),
            sa.Column('last_outbound_message_preview', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_whatsapp_conversations_lead_id', 'whatsapp_conversations', ['lead_id'])
        op.create_index('ix_whatsapp_conversations_phone_number', 'whatsapp_conversations', ['phone_number'])
        op.create_index('ix_whatsapp_conversations_status', 'whatsapp_conversations', ['status'])

    if 'whatsapp_messages' not in existing_tables:
        op.create_table(
            'whatsapp_messages',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('conversation_id', sa.String, sa.ForeignKey('whatsapp_conversations.id'), nullable=False),
            sa.Column('aisensy_message_id', sa.String(120), nullable=True, unique=True),
            sa.Column('direction', sa.String(20), nullable=False),
            sa.Column('sender_type', sa.String(20), nullable=True),
            sa.Column('message_type', sa.String(30), nullable=True),
            sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
            sa.Column('content', sa.Text, nullable=True),
            sa.Column('template_name', sa.String(120), nullable=True),
            sa.Column('campaign_name', sa.String(255), nullable=True),
            sa.Column('failure_reason', sa.Text, nullable=True),
            sa.Column('raw_payload', sa.Text, nullable=True),
            sa.Column('related_call_id', sa.String, sa.ForeignKey('call_records.id'), nullable=True),
            sa.Column('sent_at', sa.DateTime, nullable=True),
            sa.Column('delivered_at', sa.DateTime, nullable=True),
            sa.Column('read_at', sa.DateTime, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_whatsapp_messages_conversation_id', 'whatsapp_messages', ['conversation_id'])
        op.create_index('ix_whatsapp_messages_direction', 'whatsapp_messages', ['direction'])
        op.create_index('ix_whatsapp_messages_status', 'whatsapp_messages', ['status'])

    if 'aisensy_webhook_events' not in existing_tables:
        op.create_table(
            'aisensy_webhook_events',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('topic', sa.String(120), nullable=False),
            sa.Column('project_id', sa.String(120), nullable=True),
            sa.Column('delivery_attempt', sa.Integer, nullable=False, server_default='1'),
            sa.Column('status', sa.String(30), nullable=False, server_default='received'),
            sa.Column('payload_json', sa.Text, nullable=False),
            sa.Column('error_message', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('processed_at', sa.DateTime, nullable=True),
        )
        op.create_index('ix_aisensy_webhook_events_topic', 'aisensy_webhook_events', ['topic'])
        op.create_index('ix_aisensy_webhook_events_status', 'aisensy_webhook_events', ['status'])


def downgrade() -> None:
    op.drop_table('aisensy_webhook_events')
    op.drop_table('whatsapp_messages')
    op.drop_table('whatsapp_conversations')
