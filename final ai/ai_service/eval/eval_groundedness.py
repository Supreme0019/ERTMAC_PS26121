import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from app.rag.assistant import answer

CASES = [("What mud loss events happened between 2700 and 2900 m in nearby wells?", True),
         ("What mitigation was used for stuck pipe?", True),
         ("What was the bit manufacturer used in well ZZZ-999?", False),
         ("What is the reservoir pressure gradient in the deepest formation?", False)]
ok = 0
for q, should_answer in CASES:
    r = answer(q, "WELL-A-102")
    good = r["grounded"] == should_answer
    ok += good
    print(("PASS" if good else "FAIL"), "|", q, "| grounded:", r["grounded"], "| sources:", len(r["sources"]))
print(f"{ok}/{len(CASES)} behaved correctly")