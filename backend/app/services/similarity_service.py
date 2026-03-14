from __future__ import annotations

from math import sqrt

from app.models import Problem


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return -1.0

    dot = sum(a * b for a, b in zip(left, right))
    left_norm = sqrt(sum(a * a for a in left))
    right_norm = sqrt(sum(b * b for b in right))
    if left_norm == 0.0 or right_norm == 0.0:
        return -1.0
    return dot / (left_norm * right_norm)


def _tag_similarity(left: Problem, right: Problem) -> float:
    left_tags = {tag.name.casefold() for tag in left.tags}
    right_tags = {tag.name.casefold() for tag in right.tags}
    if not left_tags or not right_tags:
        return -1.0

    union = left_tags | right_tags
    if not union:
        return -1.0
    return len(left_tags & right_tags) / len(union)


def _combined_similarity(problem: Problem, candidate: Problem) -> float:
    embedding_score = _cosine_similarity(problem.embedding or [], candidate.embedding or [])
    tag_score = _tag_similarity(problem, candidate)

    has_embedding = embedding_score >= 0.0
    has_tags = tag_score >= 0.0
    if has_tags and has_embedding:
        # Tag overlap is the primary ranking signal for near-duplicate problems.
        return (0.75 * tag_score) + (0.25 * embedding_score)
    if has_tags:
        return tag_score
    if has_embedding:
        return embedding_score
    return -1.0


def find_similar(
    problem: Problem, all_problems: list[Problem], k: int = 5
) -> list[Problem]:
    if not problem.embedding and not problem.tags:
        return []

    candidates = [p for p in all_problems if p.id != problem.id]
    if not candidates:
        return []

    scored = [
        (candidate, _combined_similarity(problem, candidate)) for candidate in candidates
    ]
    ranked = sorted(
        (item for item in scored if item[1] > 0.0),
        key=lambda item: item[1],
        reverse=True,
    )
    return [candidate for candidate, _score in ranked[:k]]
