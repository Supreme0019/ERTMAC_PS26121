import fitz
from dataclasses import dataclass
from .ocr import ocr_page


@dataclass
class PageText:
    number: int
    text: str
    ocr_used: bool
    ocr_conf: float | None


def read_pdf(path, min_chars=10) -> list[PageText]:
    out = []
    with fitz.open(path) as doc:
        for i, p in enumerate(doc, 1):
            t = p.get_text("text").strip()
            if len(t) >= min_chars:
                out.append(PageText(i, t, False, None))
            else:
                t, conf = ocr_page(p)
                out.append(PageText(i, t, True, conf))
    return out