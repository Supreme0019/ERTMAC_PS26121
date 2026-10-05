import re


def extract_citations(text: str) -> list[str]:
    """Return evidence ids cited in square brackets, e.g. [E12], [E12, E13] or [E12][C5]."""
    ids = []
    for group in re.findall(r"\[([^\]]+)\]", text or ""):
        ids += re.findall(r"\b([EC]\d+)\b", group)
    return list(dict.fromkeys(ids))
