from sqlalchemy import text

from app.db.session import engine


def _sqlite_table_exists(table_name: str) -> bool:
    query = text(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :table_name"
    )
    with engine.connect() as connection:
        row = connection.execute(query, {"table_name": table_name}).first()
    return row is not None


def _sqlite_column_exists(table_name: str, column_name: str) -> bool:
    query = text(f"PRAGMA table_info({table_name})")
    with engine.connect() as connection:
        rows = connection.execute(query).all()
    existing_columns = {row[1] for row in rows}
    return column_name in existing_columns


def _add_sqlite_column_if_missing(
    table_name: str, column_name: str, ddl_type: str
) -> None:
    if not _sqlite_table_exists(table_name):
        return
    if _sqlite_column_exists(table_name, column_name):
        return
    statement = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl_type}")
    with engine.begin() as connection:
        connection.execute(statement)


def run_sqlite_compat_migrations(database_url: str) -> None:
    if not database_url.startswith("sqlite"):
        return

    # Dev-only compatibility: older SQLite files created before these fields existed.
    _add_sqlite_column_if_missing("problems", "author_id", "INTEGER")
    _add_sqlite_column_if_missing("problems", "submitted_by", "VARCHAR(120)")
    _add_sqlite_column_if_missing("problems", "content_markdown", "TEXT")
    _add_sqlite_column_if_missing("problems", "embedding", "JSON")
    _add_sqlite_column_if_missing("solutions", "submitted_by", "VARCHAR(120)")
    _add_sqlite_column_if_missing("accounts", "password_hash", "VARCHAR(512)")
    _add_sqlite_column_if_missing("accounts", "role", "VARCHAR(20) DEFAULT 'user'")
    _add_sqlite_column_if_missing("accounts", "questions_posted", "INTEGER DEFAULT 0")
    _add_sqlite_column_if_missing("accounts", "score", "INTEGER DEFAULT 0")
    _add_sqlite_column_if_missing("accounts", "is_active", "BOOLEAN DEFAULT 1")
