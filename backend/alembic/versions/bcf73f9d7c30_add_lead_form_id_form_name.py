"""add_lead_form_id_form_name

Revision ID: bcf73f9d7c30
Revises: b3c4d5e6f7a8
Create Date: 2026-04-17 23:36:42.559206

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcf73f9d7c30'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('leads', sa.Column('form_id', sa.String(length=100), nullable=True))
    op.add_column('leads', sa.Column('form_name', sa.String(length=255), nullable=True))
    op.create_index(op.f('ix_leads_form_id'), 'leads', ['form_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_leads_form_id'), table_name='leads')
    op.drop_column('leads', 'form_name')
    op.drop_column('leads', 'form_id')
