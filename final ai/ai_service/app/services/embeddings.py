import os
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()
MODEL_NAME = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
_m = None


def _model():
    global _m
    if _m is None:
        _m = SentenceTransformer(MODEL_NAME)
    return _m


def embed(texts, query=False):
    if query:
        texts = [QUERY_PREFIX + t for t in texts]
    return _model().encode(texts, normalize_embeddings=True)


def embed_documents(texts):
    return embed(texts, query=False)


def embed_query(query):
    return embed([query], query=True)[0]