"""create meetings table

Revision ID: a1b2c3d4e5f6
Revises: 929e7a7b301c
Create Date: 2026-08-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '929e7a7b301c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('meetings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(), nullable=False),
    sa.Column('title', sa.String(), nullable=False, server_default='Untitled Meeting'),
    sa.Column('transcript', sa.Text(), nullable=False),
    sa.Column('summary', sa.Text(), server_default='', nullable=True),
    sa.Column('action_items', sa.Text(), server_default='', nullable=True),
    sa.Column('key_decisions', sa.Text(), server_default='', nullable=True),
    sa.Column('open_questions', sa.Text(), server_default='', nullable=True),
    sa.Column('qdrant_collection', sa.String(), nullable=False, unique=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_meetings_id', 'meetings', ['id'])
    op.create_index('ix_meetings_user_id', 'meetings', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_meetings_user_id')
    op.drop_index('ix_meetings_id')
    op.drop_table('meetings')
