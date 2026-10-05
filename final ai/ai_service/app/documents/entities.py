"""Rule-based named-entity extraction for drilling reports (no LLM calls, no quota).

Entity types: well_id, depth, depth_interval, formation, mud_weight, pressure, flow_rate,
volume, load, equipment, material, event_mention, date.
Each entity has the exact text, character offsets inside the page text (for highlighting),
a normalised value and a unit.
"""
import re
from dataclasses import dataclass


@dataclass
class Entity:
    entity_type: str
    value: str                 # normalised, e.g. "2840" or "mud_loss"
    unit: str | None
    text: str                  # surface form as written in the document
    start: int
    end: int
    confidence: float


NUM = r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?"
DEPTH_UNIT = r"(?:mMD|m\s*MD|metres?|meters?|m)"


def _num(s: str) -> float:
    return float(s.replace(",", ""))


def _fmt(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:g}"


def _vocab(words):
    words = sorted(words, key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(re.escape(w) for w in words) + r")\b", re.I)


EQUIPMENT = _vocab(["PDC bit", "tricone bit", "roller cone bit", "drill bit", "bit", "BHA", "drill pipe", "drill string",
                    "drill collar", "casing shoe", "casing", "liner", "mud pump", "top drive", "BOP", "stabilizer",
                    "mud motor", "MWD", "LWD", "shale shaker", "kelly", "jars", "jar", "string"])
MATERIAL = _vocab(["lost circulation material", "LCM pill", "LCM", "freeing pill", "spacer", "cement slurry",
                   "cement", "barite", "bentonite", "viscous pill", "sweep"])
EVENT_PATTERNS = [
    ("mud_loss", re.compile(r"\b(?:partial\s+loss(?:es)?\s+of\s+circulation|loss(?:es)?\s+of\s+circulation|"
                            r"total\s+mud\s+loss(?:es)?|mud\s+loss(?:es)?|lost\s+returns?|static\s+losses?)\b", re.I)),
    ("stuck_pipe", re.compile(r"\b(?:differential\s+stick(?:ing)?|pipe\s+(?:became\s+)?stuck|stuck\s+pipe|overpull)\b", re.I)),
    ("torque_spike", re.compile(r"\b(?:torque\s+(?:increase|spike)|high\s+torque|erratic\s+(?:high\s+)?torque)\b", re.I)),
    ("kick", re.compile(r"\b(?:well\s+flow|pit\s+gain|kick)\b", re.I)),
]

P_INTERVAL = re.compile(rf"(?<![\w.])(?P<a>{NUM})\s*(?:-|\u2013|to)\s*(?P<b>{NUM})\s*(?P<u>{DEPTH_UNIT})\b(?![\w/])", re.I)
P_DEPTH = re.compile(rf"(?<![\w.])(?P<n>{NUM})\s*(?P<u>{DEPTH_UNIT})\b(?![\w/])")
P_MUDW = re.compile(r"(?<![\w.])(?P<n>\d+(?:\.\d+)?)\s*(?P<u>ppg|lb/gal|s\.?g\.?|g/cc|kg/m3|kg/m\u00b3|kg/l)(?![\w/])", re.I)
P_PRESS = re.compile(rf"(?<![\w.])(?P<n>{NUM})\s*(?P<u>psi|kpa|mpa|bar)\b", re.I)
P_RATE = re.compile(rf"(?<![\w.])(?P<n>{NUM})\s*(?P<u>bbl/hr|bbl/h|bph|m3/hr|m3/h|m\u00b3/h|gpm|lpm|l/min)(?![\w/])", re.I)
P_VOL = re.compile(rf"(?<![\w.])(?P<n>{NUM})\s*(?P<u>bbl|m3|m\u00b3)\b(?!\s*/)", re.I)
P_LOAD = re.compile(rf"(?<![\w.])(?P<n>{NUM})\s*(?P<u>klbs?|kN|tonnes?|tons?|daN)\b", re.I)
P_FORM = re.compile(r"\bFormation\s+[A-Z][A-Za-z0-9-]*\b")
P_WELL = re.compile(r"\b(?:SYN|VOLVE|WELL)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b")
P_DATE = re.compile(r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")


def _before(text, pos, n=40):
    return text[max(0, pos - n):pos].lower()


def _drop_overlaps(items):
    """Within one entity type keep the longest, earliest spans."""
    items = sorted(items, key=lambda e: (e.start, -(e.end - e.start)))
    out, last_end = [], -1
    for e in items:
        if e.start >= last_end:
            out.append(e)
            last_end = e.end
    return out


def extract_entities(text: str, formations=(), ocr_conf: float | None = None) -> list[Entity]:
    found: list[Entity] = []
    add = lambda *a: found.append(Entity(*a))

    interval_spans = []
    for m in P_INTERVAL.finditer(text):
        a, b = _num(m["a"]), _num(m["b"])
        if a < b <= 12000:
            add("depth_interval", f"{_fmt(a)}-{_fmt(b)}", "m", m.group(0), m.start(), m.end(), .95)
            interval_spans.append((m.start(), m.end()))
    for m in P_DEPTH.finditer(text):
        if any(s <= m.start() < e for s, e in interval_spans):
            continue
        v = _num(m["n"])
        if v > 12000:
            continue
        add("depth", _fmt(v), "m", m.group(0), m.start(), m.end(), .95 if v >= 100 else .5)
    for m in P_MUDW.finditer(text):
        ctx = _before(text, m.start())
        conf = .95 if ("mud weight" in ctx or "density" in ctx or re.search(r"\bmw\b", ctx)) else .8
        add("mud_weight", _fmt(_num(m["n"])), m["u"].lower().replace(".", ""), m.group(0), m.start(), m.end(), conf)
    for m in P_PRESS.finditer(text):
        add("pressure", _fmt(_num(m["n"])), m["u"].lower(), m.group(0), m.start(), m.end(), .9)
    for m in P_RATE.finditer(text):
        add("flow_rate", _fmt(_num(m["n"])), m["u"].lower(), m.group(0), m.start(), m.end(), .9)
    for m in P_VOL.finditer(text):
        add("volume", _fmt(_num(m["n"])), m["u"].lower(), m.group(0), m.start(), m.end(), .85)
    for m in P_LOAD.finditer(text):
        add("load", _fmt(_num(m["n"])), m["u"].lower(), m.group(0), m.start(), m.end(), .85)

    for m in P_FORM.finditer(text):
        add("formation", m.group(0), None, m.group(0), m.start(), m.end(), .9)
    names = [f for f in formations if f]
    if names:
        for m in _vocab(names).finditer(text):
            add("formation", m.group(0), None, m.group(0), m.start(), m.end(), .95)
    for m in P_WELL.finditer(text):
        add("well_id", m.group(0), None, m.group(0), m.start(), m.end(), .95)
    for m in P_DATE.finditer(text):
        add("date", m.group(0), None, m.group(0), m.start(), m.end(), .8)
    for m in EQUIPMENT.finditer(text):
        add("equipment", m.group(0).lower(), None, m.group(0), m.start(), m.end(), .8)
    for m in MATERIAL.finditer(text):
        add("material", m.group(0).lower(), None, m.group(0), m.start(), m.end(), .85)
    for etype, pat in EVENT_PATTERNS:
        for m in pat.finditer(text):
            add("event_mention", etype, None, m.group(0), m.start(), m.end(), .85)

    by_type: dict[str, list[Entity]] = {}
    for e in found:
        by_type.setdefault(e.entity_type, []).append(e)
    out = [e for items in by_type.values() for e in _drop_overlaps(items)]
    if ocr_conf is not None:                       # OCR text is less reliable
        for e in out:
            e.confidence = round(e.confidence * max(.3, ocr_conf), 2)
    return sorted(out, key=lambda e: (e.start, e.entity_type))
