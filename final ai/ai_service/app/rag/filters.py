import re

TYPE_WORDS = {"mud loss": "mud_loss", "loss of circulation": "mud_loss", "lost circulation": "mud_loss",
              "stuck": "stuck_pipe", "kick": "kick", "torque": "torque_spike", "cement": "cementing_issue"}


def parse_filters(q: str):
    ql = q.lower()
    f = {"types": sorted({t for k, t in TYPE_WORDS.items() if k in ql})}
    m = re.search(r"(\d[\d,]{2,5})\s*(?:m)?\s*(?:-|to|and)\s*(\d[\d,]{2,5})", ql)
    if m:
        lo, hi = sorted(float(x.replace(",", "")) for x in m.groups())
        f["from"], f["to"] = lo, hi
    return f
