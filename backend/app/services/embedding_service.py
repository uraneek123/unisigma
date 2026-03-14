from __future__ import annotations

from hashlib import blake2b
from math import sqrt
import re


def _fallback_embedding(problem_text: str, dims: int = 128) -> list[float]:
    tokens = re.findall(r"[a-z0-9]+", problem_text.lower())
    if not tokens:
        return []

    vector = [0.0] * dims
    for token in tokens:
        digest = blake2b(token.encode("utf-8"), digest_size=8).digest()
        bucket = int.from_bytes(digest, byteorder="big") % dims
        vector[bucket] += 1.0

    norm = sqrt(sum(value * value for value in vector))
    if norm == 0.0:
        return []
    return [value / norm for value in vector]


class EmbeddingService:
    def __init__(self) -> None:
        self.model = None
        try:
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            # Boot-safe fallback when optional ML dependency is unavailable.
            self.model = None

    def embed_problem(self, problem_text: str) -> list[float]:
        if self.model is None:
            return _fallback_embedding(problem_text)
        embedding = self.model.encode(problem_text)
        return embedding.tolist()


embedding_service = EmbeddingService()
