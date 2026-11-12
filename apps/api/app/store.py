"""SQLite persistence: rule settings, merchant registry and the transaction / audit ledger."""
import json
import sqlite3
import threading
from pathlib import Path
from typing import Iterable, List, Optional

from .engine import Merchant, RuleSettings
from .models import TransactionRecord

SCHEMA = """
CREATE TABLE IF NOT EXISTS rule_settings (
    id   INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchants (
    name              TEXT PRIMARY KEY COLLATE NOCASE,
    rating            REAL NOT NULL,
    has_return_policy INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    data       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_transactions_created ON transactions (created_at);
"""


class Store:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._lock, self._conn:
            self._conn.executescript(SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # ------------------------------------------------------------------ seeding
    def seed_if_empty(self, rules: RuleSettings, merchants: Iterable[Merchant]) -> None:
        with self._lock:
            if self.get_rules() is None:
                self.save_rules(rules)
            if not self.list_merchants():
                for m in merchants:
                    self.upsert_merchant(m)

    # ------------------------------------------------------------------ rules
    def get_rules(self) -> Optional[RuleSettings]:
        with self._lock:
            row = self._conn.execute("SELECT data FROM rule_settings WHERE id = 1").fetchone()
        return RuleSettings.model_validate_json(row["data"]) if row else None

    def save_rules(self, rules: RuleSettings) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO rule_settings (id, data) VALUES (1, ?) "
                "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                (rules.model_dump_json(),),
            )

    # ------------------------------------------------------------------ merchants
    def list_merchants(self) -> List[Merchant]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM merchants ORDER BY name COLLATE NOCASE").fetchall()
        return [self._merchant(r) for r in rows]

    def get_merchant(self, name: str) -> Optional[Merchant]:
        with self._lock:
            row = self._conn.execute("SELECT * FROM merchants WHERE name = ?", (name.strip(),)).fetchone()
        return self._merchant(row) if row else None

    def upsert_merchant(self, m: Merchant) -> Merchant:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO merchants (name, rating, has_return_policy) VALUES (?, ?, ?) "
                "ON CONFLICT(name) DO UPDATE SET rating = excluded.rating, "
                "has_return_policy = excluded.has_return_policy",
                (m.name.strip(), m.rating, int(m.has_return_policy)),
            )
        return self.get_merchant(m.name) or m

    def delete_merchant(self, name: str) -> bool:
        with self._lock, self._conn:
            cur = self._conn.execute("DELETE FROM merchants WHERE name = ?", (name.strip(),))
        return cur.rowcount > 0

    @staticmethod
    def _merchant(row: sqlite3.Row) -> Merchant:
        return Merchant(name=row["name"], rating=row["rating"], has_return_policy=bool(row["has_return_policy"]))

    # ------------------------------------------------------------------ transactions
    def insert_transaction(self, record: TransactionRecord) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO transactions (id, created_at, data) VALUES (?, ?, ?)",
                (record.id, record.created_at, record.model_dump_json()),
            )

    def update_transaction(self, record: TransactionRecord) -> None:
        with self._lock, self._conn:
            self._conn.execute("UPDATE transactions SET data = ? WHERE id = ?", (record.model_dump_json(), record.id))

    def get_transaction(self, tx_id: str) -> Optional[TransactionRecord]:
        with self._lock:
            row = self._conn.execute("SELECT data FROM transactions WHERE id = ?", (tx_id,)).fetchone()
        return TransactionRecord.model_validate_json(row["data"]) if row else None

    def find_by_receipt(self, receipt_id: str) -> Optional[TransactionRecord]:
        with self._lock:
            row = self._conn.execute(
                "SELECT data FROM transactions WHERE json_extract(data, '$.receipt_id') = ?", (receipt_id,)
            ).fetchone()
        return TransactionRecord.model_validate_json(row["data"]) if row else None

    def list_transactions(self, search: Optional[str] = None) -> List[TransactionRecord]:
        """Newest first. `search` matches merchant, item, agent, category, id or receipt id."""
        sql = "SELECT data FROM transactions"
        params: list = []
        if search and search.strip():
            like = f"%{search.strip().lower()}%"
            fields = ["merchant", "item", "agent", "category", "id", "receipt_id", "task"]
            sql += " WHERE " + " OR ".join(f"lower(json_extract(data, '$.{f}')) LIKE ?" for f in fields)
            params = [like] * len(fields)
        sql += " ORDER BY created_at DESC, rowid DESC"
        with self._lock:
            rows = self._conn.execute(sql, params).fetchall()
        return [TransactionRecord.model_validate_json(r["data"]) for r in rows]
