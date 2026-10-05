import os
import re
from typing import Literal
from pydantic import BaseModel, Field, ValidationError
from ..services.llm import complete_json

EXTRACTOR_VERSION = "llm-extract-v1"


class ExtractedEvent(BaseModel):
    event_type: Literal["mud_loss", "stuck_pipe", "kick", "torque_spike", "cementing_issue", "other"]
    depth_m: float | None = None
    formation: str | None = None
    severity: Literal["low", "medium", "high", "unknown"] = "unknown"
    description: str
    mitigation: str | None = None
    outcome: str | None = None
    evidence_quote: str
    llm_confidence: float = Field(ge=0, le=1)


class PageExtraction(BaseModel):
    events: list[ExtractedEvent]


SYSTEM = """You extract drilling incidents from one page of a drilling report.
Return ONLY JSON: {"events":[{"event_type","depth_m","formation","severity","description","mitigation","outcome","evidence_quote","llm_confidence"}]}.
Rules: report only events explicitly stated in the text; never infer. depth_m is measured depth in metres as a number.
evidence_quote MUST be copied verbatim from the page (one sentence). If unsure of a field use null, or "unknown" for severity.
Ignore routine operations. event_type must be one of: mud_loss, stuck_pipe, kick, torque_spike, cementing_issue, other.
llm_confidence is a number from 0 to 1. If there are no incidents, return {"events":[]}."""


def _norm(s):
    return re.sub(r"\s+", " ", s.lower()).strip()

def extract_page(text: str) -> list[ExtractedEvent]:
    for _ in range(2):                      # one retry on bad output
        try:
            data = complete_json(SYSTEM, text)
            if isinstance(data, list):      # tolerate a bare list
                data = {"events": data}
            return PageExtraction(**data).events
        except (ValueError, ValidationError, TypeError):
            continue
    return []

def score(ev: ExtractedEvent, page_text: str, well_td: float, ocr_conf: float | None) -> float:
    c = ev.llm_confidence
    if _norm(ev.evidence_quote) not in _norm(page_text):      # grounding check
        c *= 0.4
    if ev.depth_m is None or not (0 < ev.depth_m <= well_td * 1.02):
        c *= 0.6
    if ocr_conf is not None:
        c *= max(0.3, ocr_conf)
    return round(c, 2)

EXTRACT_MODEL = os.getenv("EXTRACT_MODEL") or None       # optional separate model for extraction

KEYWORDS = ("loss", "lost return", "stuck", "sticking", "overpull", "torque",
            "flow observed", "pit gain", "kick", "cement")


def looks_eventful(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in KEYWORDS)


def extract_document(pages) -> list[ExtractedEvent]:
    """ONE LLM call per document. Routine pages are dropped first; no incident words -> no call."""
    eventful = [p for p in pages if looks_eventful(p.text)]
    if not eventful:
        return []
    text = "\n\n".join(f"=== PAGE {p.number} ===\n{p.text}" for p in eventful)
    for _ in range(2):                                   # one retry on unparseable output
        try:
            data = complete_json(SYSTEM, text, max_tokens=8192, model=EXTRACT_MODEL)
            if isinstance(data, list):
                data = {"events": data}
            return PageExtraction(**data).events
        except (ValueError, ValidationError, TypeError):
            continue
    return []