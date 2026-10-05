import os, json, re, time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../../../.env"))
load_dotenv("../.env")
API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("LLM_MODEL", "gemini-3.8-flash")

_client = None

def get_client():
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY") or API_KEY
        if not key:
            raise RuntimeError("GEMINI_API_KEY is missing from .env")
        _client = genai.Client(api_key=key)
    return _client

try:
    client = get_client() if API_KEY else None
except Exception:
    client = None


class DailyQuotaExceeded(Exception):
    pass


def complete(system: str, user: str, max_tokens: int = 4096, json_mode: bool = False, model: str | None = None) -> str:
    """
    Generate content with Google Gemini with fast-abort retry logic.
    Capped at 2 attempts with short backoff (max 3s total) so response time
    never exceeds the Node backend's 30-second client timeout.
    """
    cfg = types.GenerateContentConfig(
        system_instruction=system,
        max_output_tokens=max_tokens,
        response_mime_type="application/json" if json_mode else None,
    )

    for attempt in range(2):
        try:
            cli = client or get_client()
            r = cli.models.generate_content(model=model or MODEL, contents=user, config=cfg)
            return r.text or ""
        except Exception as e:
            msg = str(e)
            if "PerDay" in msg or "per day" in msg.lower():
                raise DailyQuotaExceeded(msg[:200])
            low = msg.lower()
            # If not a temporary rate limit / 503 or if last attempt, raise immediately
            if attempt == 1 or not ("429" in msg or "rate" in low or "quota" in low or "503" in msg or "unavailable" in low):
                raise
            # Fast backoff: 1.5s on attempt 0 (max total sleep 1.5s)
            time.sleep(1.5)


def complete_json(system: str, user: str, **kw) -> dict:
    from .jsonutil import parse_json
    text = complete(system, user, json_mode=True, **kw)
    return parse_json(text)