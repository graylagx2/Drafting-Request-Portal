import os
from logging.config import fileConfig

from flask import current_app
from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# --- Start Manual Path Fix ---
# Construct path to alembic.ini at the project root
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
alembic_ini_path = os.path.join(project_root, 'alembic.ini')

if os.path.exists(alembic_ini_path):
    fileConfig(alembic_ini_path)
else:
    # Fallback to original behavior if our path logic is wrong
    if config.config_file_name is not None:
        fileConfig(config.config_file_name)
# --- End Manual Path Fix ---


# Set the database URL from the Flask app config
config.set_main_option('sqlalchemy.url', current_app.config.get('SQLALCHEMY_DATABASE_URI'))

# add your model's MetaData object here
# for 'autogenerate' support
from app.extensions import db
target_metadata = db.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # this callback is used here to prevent an auto-migration
    # from being generated when there are no changes to the schema
    # see: https://alembic.sqlalchemy.org/en/latest/cookbook.html#don-t-generate-empty-migrations-with-autogenerate
    def process_revision_directives(context, revision, directives):
        if config.cmd_opts.autogenerate and all(not d for d in directives):
            directives[:] = []

    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
