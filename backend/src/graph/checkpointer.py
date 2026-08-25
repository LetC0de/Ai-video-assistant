"""PostgreSQL checkpointer for LangGraph.

PostgresSaver persists the entire graph state (including `messages`) per
thread_id. This is the short-term memory layer. Application-level conversation
metadata lives in the `conversations` table — that table does NOT store message
contents.

Lifecycle:
    - init_checkpointer() is called ONCE at FastAPI startup (in the lifespan).
    - setup() is called there too — it creates the LangGraph tables (idempotent).
    - get_checkpointer() returns the live singleton for the compiled graph.
    - delete_thread() wipes the checkpoint history for a deleted conversation.

We back the saver with an AsyncConnectionPool (not a single raw connection):
    a single long-lived connection shared across concurrent requests was the
    cause of intermittent `psycopg.OperationalError: the connection is closed` —
    one request closing/committing the shared connection took down every other
    in-flight request. The pool hands each concurrent request its own connection
    and returns it afterwards, which is the correct model for FastAPI's
    concurrent async handlers.
"""
from __future__ import annotations

import logging
from typing import Optional

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from src.utils.settings import settings


log = logging.getLogger(__name__)

# Module-level singleton — initialised by init_checkpointer() in the FastAPI
# lifespan, before the first request arrives.
_checkpointer: Optional[AsyncPostgresSaver] = None
# The connection pool backing the saver; held so we can close it cleanly on
# shutdown (releasing every pooled connection).
_pool: Optional[AsyncConnectionPool] = None


def _build_connection_string() -> str:
    """The settings DB connection is a libpq/SQLAlchemy style URL.

    AsyncPostgresSaver.from_conn_string passes it straight to psycopg's async
    connect, which handles `postgresql://...?sslmode=require&...` directly.
    """
    return settings.DB_CONNECTION


async def init_checkpointer() -> AsyncPostgresSaver:
    """Create the AsyncPostgresSaver and run setup() once.

    Safe to call multiple times: subsequent calls return the cached instance.
    """
    global _checkpointer, _pool

    if _checkpointer is not None:
        return _checkpointer

    conn_string = _build_connection_string()

    # One pool for the whole process. open=False so we control startup; we open
    # it explicitly and run setup() against it. SSL is read from the connection
    # string itself, so no extra ssl kwarg is needed.
    #
    # Idle recycling: cloud Postgres (Supabase/Neon) silently drops idle
    # connections after a few minutes. Without bounds the pool would hand those
    # now-BAD connections back to a later request, surfacing as
    # "SSL connection has been closed unexpectedly" / "the connection is closed".
    # - max_idle: a pooled connection sits idle this long, then the pool closes
    #   and replaces it (kept BELOW the server's idle timeout so we recycle
    #   before the server does). This is the primary guard against the
    #   "SSL connection has been closed unexpectedly" failure — it lets the pool
    #   retire a stale idle connection on its own timer rather than handing it to
    #   a query and hanging until TCP timeout.
    # - max_lifetime: hard cap on a connection's age — even a busy connection is
    #   recycled, preventing slow memory/state drift on the server side.
    # - keepalives: enable TCP keepalive (passed through to the connection) so a
    #   dropped/stale socket is detected quickly.
    # check: validate a connection on checkout with a single SELECT 1. Idle
    # recycling (max_idle/max_lifetime) retires conns on a timer, but a connection
    # can still die between recycle and the next query (we saw
    # "server closed the connection unexpectedly" on aget_state). The check callback
    # makes the pool discard a dead connection and hand out a fresh one instead of
    # letting the checkpoint read/write fail. One lightweight round-trip per
    # checkout is a fair price for not dropping chat turns.
    async def _check_connection(conn) -> None:
        async with conn.cursor() as cur:
            await cur.execute("SELECT 1")

    _pool = AsyncConnectionPool(
        conn_string,
        open=False,
        max_size=20,
        max_idle=280,          # recycle idle conns before the ~5min server drop
        max_lifetime=1800,     # 30min hard cap on connection age
        check=_check_connection,
        kwargs={"autocommit": True, "keepalives": 1},
    )
    await _pool.open()

    saver = AsyncPostgresSaver(conn=_pool)

    # setup() creates the LangGraph tables (checkpoint, checkpoint_writes,
    # checkpoint_blobs, checkpoint_migrations). Idempotent — running twice is safe.
    await saver.setup()

    _checkpointer = saver
    log.info("AsyncPostgresSaver initialised (pooled); LangGraph checkpoint tables ensured.")
    return _checkpointer


def get_checkpointer() -> AsyncPostgresSaver:
    """Return the singleton checkpointer.

    Raises if init_checkpointer() hasn't run yet (i.e. outside the FastAPI
    lifespan — a programming error).
    """
    if _checkpointer is None:
        raise RuntimeError(
            "Checkpointer not initialised. Call init_checkpointer() during "
            "application startup (lifespan) before handling requests."
        )
    return _checkpointer


def make_thread_id(user_id: int, conversation_id: int) -> str:
    """Deterministic, namespaced thread identifier.

    Format: `user-{user_id}-conversation-{conversation_id}`

    Namespacing by user gives an additional isolation layer even before the
    application-level ownership check. Always validate ownership in the
    application DB too.
    """
    return f"user-{user_id}-conversation-{conversation_id}"


async def delete_thread(user_id: int, conversation_id: int) -> None:
    """Delete all checkpoints for a (user, conversation) thread.

    Called when the user deletes a conversation. Best-effort: if the checkpointer
    isn't ready (e.g. mid-shutdown) we silently skip — orphaned checkpoints
    don't break anything.
    """
    if _checkpointer is None:
        return
    thread_id = make_thread_id(user_id, conversation_id)
    try:
        await _checkpointer.adelete_thread(thread_id)
    except Exception as exc:
        log.warning("Failed to delete thread %s: %s", thread_id, exc)


async def close_checkpointer() -> None:
    """Release the connection pool at app shutdown (best-effort)."""
    global _checkpointer, _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception as exc:
            log.warning("Error closing checkpointer pool: %s", exc)
    _checkpointer = None
    _pool = None
