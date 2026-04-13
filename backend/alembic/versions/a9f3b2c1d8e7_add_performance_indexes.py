"""add_performance_indexes

Adds indexes on the columns that are hit most frequently by analytics queries,
the leads list endpoint, and bulk operations.  Without these PostgreSQL does
full-table scans on every analytics request.

Indexes added:
  leads               — created_at, updated_at, assigned_agent_id,
                        next_followup_at, source_campaign, last_contacted_at
  call_records        — created_at, agent_id

Revision ID: a9f3b2c1d8e7
Revises: f1e2d3c4b5a6
Create Date: 2026-04-13 08:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a9f3b2c1d8e7"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    leads_indexes = {idx["name"] for idx in inspector.get_indexes("leads")}
    call_indexes = {idx["name"] for idx in inspector.get_indexes("call_records")}

    # ── leads: columns used in analytics GROUP BY / WHERE / ORDER BY ─────────

    if "ix_leads_created_at" not in leads_indexes:
        op.create_index("ix_leads_created_at", "leads", ["created_at"])

    if "ix_leads_updated_at" not in leads_indexes:
        op.create_index("ix_leads_updated_at", "leads", ["updated_at"])

    if "ix_leads_assigned_agent_id" not in leads_indexes:
        op.create_index("ix_leads_assigned_agent_id", "leads", ["assigned_agent_id"])

    if "ix_leads_next_followup_at" not in leads_indexes:
        op.create_index("ix_leads_next_followup_at", "leads", ["next_followup_at"])

    if "ix_leads_source_campaign" not in leads_indexes:
        op.create_index("ix_leads_source_campaign", "leads", ["source_campaign"])

    if "ix_leads_last_contacted_at" not in leads_indexes:
        op.create_index("ix_leads_last_contacted_at", "leads", ["last_contacted_at"])

    # ── call_records: columns used in analytics GROUP BY / WHERE / JOIN ───────

    if "ix_call_records_created_at" not in call_indexes:
        op.create_index("ix_call_records_created_at", "call_records", ["created_at"])

    if "ix_call_records_agent_id" not in call_indexes:
        op.create_index("ix_call_records_agent_id", "call_records", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_leads_created_at", table_name="leads")
    op.drop_index("ix_leads_updated_at", table_name="leads")
    op.drop_index("ix_leads_assigned_agent_id", table_name="leads")
    op.drop_index("ix_leads_next_followup_at", table_name="leads")
    op.drop_index("ix_leads_source_campaign", table_name="leads")
    op.drop_index("ix_leads_last_contacted_at", table_name="leads")
    op.drop_index("ix_call_records_created_at", table_name="call_records")
    op.drop_index("ix_call_records_agent_id", table_name="call_records")
