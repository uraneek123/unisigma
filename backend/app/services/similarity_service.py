import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from app.models import Problem

def find_similar(problem: Problem, all_problems: list[Problem], k: int = 5) -> list[Problem]:
    if not problem.embedding:
        return []

    query = np.array(problem.embedding).reshape(1, -1)
    candidates = [p for p in all_problems if p.embedding and p.id != problem.id]
    if not candidates:
        return []

    embeddings = np.array([p.embedding for p in candidates])
    scores = cosine_similarity(query, embeddings)[0]

    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    return [p for p, _ in ranked[:k]]