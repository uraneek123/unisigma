from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import engine
from app.main import app


def setup_function() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_problem_crud_flow() -> None:
    client = TestClient(app)

    tag_response = client.post("/tags", json={"name": "algebra"})
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    source_response = client.post(
        "/sources",
        json={"title": "Mock Contest Paper", "author": "UniSigma", "year": 2025},
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    problem_response = client.post(
        "/problems",
        json={
            "statement_text": "Solve x^2 - 5x + 6 = 0.",
            "statement_latex": r"Solve x^2 - 5x + 6 = 0.",
            "tag_ids": [tag_id],
            "sources": [{"source_id": source_id, "is_primary": True}],
        },
    )
    assert problem_response.status_code == 201
    problem = problem_response.json()
    assert problem["statement_text"] == "Solve x^2 - 5x + 6 = 0."
    assert problem["tags"][0]["name"] == "algebra"
    assert problem["sources"][0]["source"]["title"] == "Mock Contest Paper"

    solution_response = client.post(
        f"/problems/{problem['id']}/solutions",
        json={"body_text": "Factor into (x-2)(x-3)=0."},
    )
    assert solution_response.status_code == 201

    fetched_problem = client.get(f"/problems/{problem['id']}")
    assert fetched_problem.status_code == 200
    assert (
        fetched_problem.json()["solutions"][0]["body_text"]
        == "Factor into (x-2)(x-3)=0."
    )
