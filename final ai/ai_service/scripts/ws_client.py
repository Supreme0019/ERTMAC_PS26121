import asyncio, json, sys
import websockets


async def main(speed="20", start="2780"):
    url = f"ws://localhost:8001/realtime/WELL-A-102?speed={speed}&start_depth={start}"
    async with websockets.connect(url) as ws:
        async for raw in ws:
            m = json.loads(raw)
            if m.get("done"):
                print("stream finished"); break
            s = m["state"]
            line = f"{s['depth']:.0f} m  {s['formation']}  mud_loss={s['mud_loss']:.1f}"
            if m["risks"]:
                t = m["risks"][0]
                line += f"  | {t['risk_type']} {t['risk_level']} {t['score']}"
                if t["score_breakdown"]["anomaly"]:
                    line += "  [live anomaly]"
                if t.get("new"):
                    line += "  <-- NEW/CHANGED"
            print(line)

asyncio.run(main(*sys.argv[1:]))