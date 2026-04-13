"""add_class_centers_batches_enrollment

Revision ID: b3c4d5e6f7a8
Revises: 0eab50e247de
Create Date: 2026-04-13 10:00:00.000000

Adds:
  - class_centers  table
  - class_batches  table (FK → class_centers)
  - leads.class_center_id   FK → class_centers.id
  - leads.class_batch_id    FK → class_batches.id
  - leads.enrollment_status VARCHAR(30) default 'none'
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "0eab50e247de"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── class_centers ─────────────────────────────────────────────────────────
    op.create_table(
        "class_centers",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("map_url", sa.String(500), nullable=True),
        sa.Column(
            "mode",
            sa.String(20),
            nullable=False,
            server_default="offline",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_class_centers_name", "class_centers", ["name"])

    # ── class_batches ──────────────────────────────────────────────────────────
    op.create_table(
        "class_batches",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("center_id", sa.String(), nullable=False),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("time_slot", sa.String(80), nullable=True),
        sa.Column(
            "mode",
            sa.String(20),
            nullable=False,
            server_default="offline",
        ),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["center_id"], ["class_centers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_class_batches_center_id", "class_batches", ["center_id"])
    op.create_index("ix_class_batches_is_active", "class_batches", ["is_active"])

    # ── leads: three new columns ───────────────────────────────────────────────
    op.add_column(
        "leads",
        sa.Column("class_center_id", sa.String(), sa.ForeignKey("class_centers.id"), nullable=True),
    )
    op.add_column(
        "leads",
        sa.Column("class_batch_id", sa.String(), sa.ForeignKey("class_batches.id"), nullable=True),
    )
    op.add_column(
        "leads",
        sa.Column(
            "enrollment_status",
            sa.String(30),
            nullable=False,
            server_default="none",
        ),
    )
    op.create_index("ix_leads_class_center_id", "leads", ["class_center_id"])
    op.create_index("ix_leads_class_batch_id", "leads", ["class_batch_id"])
    op.create_index("ix_leads_enrollment_status", "leads", ["enrollment_status"])


def downgrade() -> None:
    op.drop_index("ix_leads_enrollment_status", table_name="leads")
    op.drop_index("ix_leads_class_batch_id", table_name="leads")
    op.drop_index("ix_leads_class_center_id", table_name="leads")
    op.drop_column("leads", "enrollment_status")
    op.drop_column("leads", "class_batch_id")
    op.drop_column("leads", "class_center_id")

    op.drop_index("ix_class_batches_is_active", table_name="class_batches")
    op.drop_index("ix_class_batches_center_id", table_name="class_batches")
    op.drop_table("class_batches")

    op.drop_index("ix_class_centers_name", table_name="class_centers")
    op.drop_table("class_centers")
