import os
from google import genai

key = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
client = genai.Client(api_key=key)

try:
    for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
        try:
            r = client.models.generate_content(
                model=model_name,
                contents="Say hello in 5 words"
            )
            print(f"SUCCESS with {model_name}: {r.text.strip()}")
            break
        except Exception as e:
            print(f"Failed with {model_name}: {e}")
except Exception as e:
    print(f"Fatal error: {e}")
