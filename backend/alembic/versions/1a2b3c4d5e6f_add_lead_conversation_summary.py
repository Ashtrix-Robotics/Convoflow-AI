"""add_lead_conversation_summary

Revision ID: 1a2b3c4d5e6f
Revises: 0eab50e247de
Create Date: 2026-04-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a2b3c4d5e6f'
down_revision: Union[str, None] = '0eab50e247de'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leads', sa.Column('conversation_summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('leads', 'conversation_summary')
