"""add_app_settings_campaign_knowledge

Revision ID: 154543e33e0e
Revises: 30db0ce369b2
Create Date: 2026-04-05 19:27:55.518235

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '154543e33e0e'
down_revision: Union[str, None] = '30db0ce369b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'app_settings' not in existing_tables:
        op.create_table(
            'app_settings',
            sa.Column('key', sa.String(120), primary_key=True),
            sa.Column('value', sa.Text, nullable=False, server_default=''),
            sa.Column('description', sa.Text, nullable=True),
            sa.Column('updated_by_agent_id', sa.String, sa.ForeignKey('agents.id'), nullable=True),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )

    if 'campaign_knowledge' not in existing_tables:
        op.create_table(
            'campaign_knowledge',
            sa.Column('id', sa.String, primary_key=True),
            sa.Column('aisensy_campaign_name', sa.String(255), nullable=False, unique=True),
            sa.Column('display_name', sa.String(255), nullable=False),
            sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
            sa.Column('is_default', sa.Boolean, nullable=False, server_default='false'),
            sa.Column('template_params_schema_json', sa.Text, nullable=True),
            sa.Column('default_template_params_json', sa.Text, nullable=True),
            sa.Column('product_name', sa.String(255), nullable=True),
            sa.Column('product_description', sa.Text, nullable=True),
            sa.Column('key_selling_points', sa.Text, nullable=True),
            sa.Column('pricing_info', sa.Text, nullable=True),
            sa.Column('target_audience', sa.Text, nullable=True),
            sa.Column('tone', sa.String(30), nullable=False, server_default='friendly'),
            sa.Column('ai_persona_prompt', sa.Text, nullable=True),
            sa.Column('faq_json', sa.Text, nullable=True),
            sa.Column('objections_json', sa.Text, nullable=True),
            sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_campaign_knowledge_aisensy_campaign_name', 'campaign_knowledge', ['aisensy_campaign_name'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_campaign_knowledge_aisensy_campaign_name', table_name='campaign_knowledge')
    op.drop_table('campaign_knowledge')
    op.drop_table('app_settings')
