import pandas as pd, random, textwrap, pathlib, fitz
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

random.seed(7)
S = pathlib.Path("../data/synthetic")
R = pathlib.Path("../data/reports"); R.mkdir(parents=True, exist_ok=True)
wells = pd.read_csv(S / "wells.csv")
ev = pd.read_csv(S / "events_truth.csv")

TEMPLATES = {
    "mud_loss": [
        "At {d} a partial loss of circulation was observed in {f}. Losses of about {q} bbl/hr. {m}. Circulation regained.",
        "Total mud losses noted at {d} ({f}). Static losses recorded. Action taken: {m}.",
        "Lost returns while drilling {f} near {d}; {m}, then drilling resumed."],
    "stuck_pipe": [
        "Pipe became stuck at {d} in {f} with overpull of {q} klbs. {m}.",
        "Differential sticking suspected at {d} ({f}). {m}; string freed."],
    "torque_spike": [
        "Sudden torque increase recorded at {d} in {f}. {m}.",
        "Erratic high torque observed around {d}. Formation: {f}. Response: {m}."],
    "kick": [
        "Well flow observed at {d} ({f}); pit gain of {q} bbl. {m}."],
}
FILL = ["Drilled ahead with no issues. Mud properties within programme.",
        "Tripped for bit change. BHA inspected.",
        "Routine survey taken; inclination within plan.",
        "Circulated bottoms up. Connection gas normal."]


def dfmt(d):
    return random.choice([f"{d:,} m", f"{d}m MD", f"{d} m"])


def cap(s):
    return s[0].upper() + s[1:]


def write_pdf(path, pages):
    c = canvas.Canvas(str(path), pagesize=A4)
    for lines in pages:
        y = 800
        for ln in lines:
            for w in (textwrap.wrap(ln, 95) or [""]):
                c.drawString(50, y, w)
                y -= 15
        c.showPage()
    c.save()


def rasterize(src, dst):
    """Turn a text PDF into an image-only PDF (simulates a scan)."""
    d = fitz.open(src)
    out = fitz.open()
    for p in d:
        pix = p.get_pixmap(dpi=150)
        page = out.new_page(width=p.rect.width, height=p.rect.height)
        page.insert_image(page.rect, stream=pix.tobytes("png"))
    out.save(dst)
    out.close()
    d.close()


truth = []
with_events = list(ev.well_id.unique())[:25]
without = list(wells[~wells.id.isin(ev.well_id) & wells.id.str.startswith("SYN")].id)[:5]

for wid in with_events + without:
    w = wells[wells.id == wid].iloc[0]
    we = ev[ev.well_id == wid].sort_values("depth")

    pages = [["DAILY DRILLING REPORT / WELL COMPLETION REPORT (SYNTHETIC DEMO DATA)",
              f"Well: {wid}   Field: {w.field}   Type: {w.well_type}   TD: {int(w.total_depth)} m", ""]]

    entries = []
    for d in range(1500, int(w.total_depth), 100):
        lines = [f"Report interval {d}-{d + 100} m", random.choice(FILL)]
        for e in we[(we.depth >= d) & (we.depth < d + 100)].itertuples():
            q = random.randint(10, 80)
            lines.append(random.choice(TEMPLATES[e.event_type]).format(
                d=dfmt(int(e.depth)), f=e.formation, q=q, m=cap(e.mitigation)))
            truth.append(dict(well_id=wid, event_type=e.event_type, depth=e.depth,
                              section="daily", event_id=e.event_id))
        entries.append(lines)

    for i in range(0, len(entries), 4):          # 4 daily entries per page
        block = []
        for x in entries[i:i + 4]:
            block.extend(x + [""])
        pages.append(block)

    lessons = ["LESSONS LEARNED"] + [
        f"- {e.event_type.replace('_', ' ')} issue near {int(e.depth)} m; mitigation: {e.mitigation}."
        for e in we.itertuples()]
    pages.append(lessons)

    tmp = R / f"{wid}_ddr.pdf"
    write_pdf(tmp, pages)
    if random.random() < .35:                     # ~1/3 become "scanned"
        rasterize(tmp, R / f"{wid}_ddr_scan.pdf")
        tmp.unlink()

pd.DataFrame(truth).to_csv(S / "reports_truth.csv", index=False)
print(f"{len(with_events) + len(without)} reports written | {len(truth)} truth events in daily sections")