import io, shutil
import pytesseract
from PIL import Image

if not shutil.which("tesseract"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"


def ocr_page(page, dpi=200):
    img = Image.open(io.BytesIO(page.get_pixmap(dpi=dpi).tobytes("png")))
    d = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    confs = [float(c) for t, c in zip(d["text"], d["conf"]) if t.strip() and float(c) >= 0]
    return pytesseract.image_to_string(img), (sum(confs) / len(confs) / 100 if confs else 0.0)