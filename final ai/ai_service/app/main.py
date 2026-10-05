from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import similar, risk, assistant, realtime, search, ingest, documents

app = FastAPI(title="NWIS AI Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

_routers = [similar, risk, assistant, realtime, search, ingest, documents]

# ML router is optional: if dependencies (joblib, etc.) are not installed, the
# rest of the service starts normally and only the /ml/risk endpoint is missing.
try:
    from .routers import ml as _ml_router
    _routers.append(_ml_router)
except Exception:
    pass

for r in _routers:
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"ok": True}