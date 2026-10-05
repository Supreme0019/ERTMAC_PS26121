import psycopg
import psycopg.rows
from contextlib import contextmanager
from pgvector.psycopg import register_vector
from .config import settings

@contextmanager
def conn():
    with psycopg.connect(settings.database_url, row_factory=psycopg.rows.dict_row) as c:
        register_vector(c)
        yield c