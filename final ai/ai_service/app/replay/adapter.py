import asyncio
import pandas as pd
from typing import AsyncIterator, Protocol


class DataSource(Protocol):
    def stream(self) -> AsyncIterator[dict]: ...


class ReplaySource:
    """Emits one active-well record per interval. A real eRTMAC adapter would implement the same stream()."""

    def __init__(self, csv_path: str, interval: float = 1.0, start_depth: float | None = None):
        import os
        if not os.path.exists(csv_path):
            alt = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "synthetic", "active_replay.csv")
            if os.path.exists(alt):
                csv_path = alt
        df = pd.read_csv(csv_path) if os.path.exists(csv_path) else pd.DataFrame()
        if not df.empty and start_depth is not None:
            filtered = df[df.depth >= start_depth]
            if not filtered.empty:
                df = filtered
        self.rows = df.to_dict("records") if not df.empty else []
        self.interval = interval

    async def stream(self):
        for row in self.rows:
            yield row
            await asyncio.sleep(self.interval)