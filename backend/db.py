"""SQLite storage for registered users and the security audit log."""
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT,
    department  TEXT,
    samples     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at      TEXT NOT NULL,
    event           TEXT NOT NULL,
    decision        TEXT,
    user_id         INTEGER,
    user_name       TEXT,
    liveness_score  REAL,
    deepfake_score  REAL,
    match_distance  REAL,
    latency_ms      INTEGER
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class Database:
    def __init__(self, path: Path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as c:
            c.executescript(SCHEMA)

    @contextmanager
    def _conn(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # ---- users -------------------------------------------------------------
    def add_user(self, name, email, department, samples) -> int:
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO users(name,email,department,samples,created_at) VALUES(?,?,?,?,?)",
                (name, email, department, samples, utcnow()))
            return cur.lastrowid

    def list_users(self):
        with self._conn() as c:
            return [dict(r) for r in c.execute("SELECT * FROM users ORDER BY id DESC")]

    def get_user(self, user_id):
        with self._conn() as c:
            row = c.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
            return dict(row) if row else None

    def delete_user(self, user_id) -> bool:
        with self._conn() as c:
            return c.execute("DELETE FROM users WHERE id=?", (user_id,)).rowcount > 0

    def count_users(self) -> int:
        with self._conn() as c:
            return c.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    # ---- audit log ---------------------------------------------------------
    def log(self, event, decision=None, user_id=None, user_name=None,
            liveness=None, deepfake=None, distance=None, latency_ms=None):
        with self._conn() as c:
            c.execute(
                "INSERT INTO audit_log(created_at,event,decision,user_id,user_name,"
                "liveness_score,deepfake_score,match_distance,latency_ms) VALUES(?,?,?,?,?,?,?,?,?)",
                (utcnow(), event, decision, user_id, user_name, liveness, deepfake, distance, latency_ms))

    def recent_logs(self, limit=25):
        with self._conn() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))]

    def stats(self, days: int = 7):
        with self._conn() as c:
            by_decision = {r["decision"]: r["n"] for r in c.execute(
                "SELECT decision, COUNT(*) n FROM audit_log WHERE event='verify' GROUP BY decision")}
            total = sum(by_decision.values())
            avg_latency = c.execute(
                "SELECT AVG(latency_ms) FROM audit_log WHERE event='verify'").fetchone()[0]
            since = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
            per_day = {r["d"]: r["n"] for r in c.execute(
                "SELECT substr(created_at,1,10) d, COUNT(*) n FROM audit_log "
                "WHERE event='verify' AND substr(created_at,1,10)>=? GROUP BY d", (since,))}
        series = []
        for i in range(days):
            day = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d")
            series.append({"day": day, "count": per_day.get(day, 0)})
        return {"total_verifications": total, "by_decision": by_decision,
                "avg_latency_ms": round(avg_latency) if avg_latency else 0, "per_day": series}
