"""add_supabase_uid_to_agents

Revision ID: a1b2c3d4e5f6
Revises: 154543e33e0e
Create Date: 2026-04-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '154543e33e0e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_cols = {c["name"] for c in inspector.get_columns("agents")}

    if "supabase_uid" not in existing_cols:
        op.add_column(
            "agents",
            sa.Column("supabase_uid", sa.String(36), nullable=True),
        )
        # Add unique index for supabase_uid (NULLs are not considered equal in Postgres,
        # so multiple un-linked agents can coexist safely).
        op.create_index(
            "ix_agents_supabase_uid",
            "agents",
            ["supabase_uid"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    existing_cols = {c["name"] for c in inspector.get_columns("agents")}
    existing_idx = {i["name"] for i in inspector.get_indexes("agents")}

    if "ix_agents_supabase_uid" in existing_idx:
        op.drop_index("ix_agents_supabase_uid", table_name="agents")

    if "supabase_uid" in existing_cols:
        op.drop_column("agents", "supabase_uid")
