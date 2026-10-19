"""In-memory stand-in for the supabase-py client, covering the query builder calls the app uses.

Embedded relations (e.g. `patients(...)` in a select) aren't resolved: tests that need them put the
embedded object on the seeded row directly.
"""

import copy
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace


class FakeQuery:
    def __init__(self, rows: list[dict]):
        self.rows = rows
        self.op = "select"
        self.payload = None
        self.on_conflict = None
        self.filters = []
        self.order_by = []
        self.max_rows = None
        self.count = None
        self.columns = None

    def select(self, columns="*", count=None):
        self.count = count
        # Plain column lists are applied, so tests can check that fields like password_hash aren't returned.
        if "*" not in columns and "(" not in columns:
            self.columns = [c.strip() for c in columns.split(",")]
        return self

    def insert(self, data):
        self.op, self.payload = "insert", data
        return self

    def update(self, data):
        self.op, self.payload = "update", data
        return self

    def upsert(self, data, on_conflict="id"):
        self.op, self.payload, self.on_conflict = "upsert", data, on_conflict
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def gte(self, column, value):
        self.filters.append(lambda r: r.get(column) is not None and r[column] >= value)
        return self

    def lt(self, column, value):
        self.filters.append(lambda r: r.get(column) is not None and r[column] < value)
        return self

    def ilike(self, column, pattern):
        self.filters.append(lambda r: (r.get(column) or "").lower() == pattern.lower())
        return self

    def order(self, column, desc=False):
        self.order_by.append((column, desc))
        return self

    def limit(self, n):
        self.max_rows = n
        return self

    def _matches(self) -> list[dict]:
        return [r for r in self.rows if all(f(r) for f in self.filters)]

    def execute(self):
        if self.op == "insert":
            data = [self._insert(r) for r in (self.payload if isinstance(self.payload, list) else [self.payload])]
        elif self.op == "update":
            data = []
            for r in self._matches():
                r.update(self.payload)
                data.append(copy.deepcopy(r))
        elif self.op == "upsert":
            existing = [r for r in self.rows if r.get(self.on_conflict) == self.payload.get(self.on_conflict)]
            if existing:
                existing[0].update(self.payload)
                data = [copy.deepcopy(existing[0])]
            else:
                data = [self._insert(self.payload)]
        else:
            data = self._matches()
            for column, desc in reversed(self.order_by):
                data.sort(key=lambda r: (r.get(column) is None, r.get(column) or ""), reverse=desc)
            if self.max_rows is not None:
                data = data[: self.max_rows]
            if self.columns:
                data = [{c: r.get(c) for c in self.columns} for r in data]
            data = copy.deepcopy(data)
        return SimpleNamespace(data=data, count=len(data) if self.count else None)

    def _insert(self, row: dict) -> dict:
        row = {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()} | row
        self.rows.append(row)
        return copy.deepcopy(row)


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self.tables.setdefault(name, []))

    def add(self, table: str, **row) -> dict:
        """Seed a row directly and return it (with a generated id if none was given)."""
        return self.table(table).insert(row).execute().data[0]
