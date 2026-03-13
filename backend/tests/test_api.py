from fastapi.testclient import TestClient

from app.api.routes import problems as problems_routes
from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.services.pix2text_ocr import OcrExtractionResult


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


def test_tag_name_cannot_be_blank() -> None:
    client = TestClient(app)

    response = client.post("/tags", json={"name": "   "})

    assert response.status_code == 422


def test_problem_rejects_duplicate_source_links() -> None:
    client = TestClient(app)

    source_response = client.post(
        "/sources",
        json={"title": "Mock Contest Paper", "author": "UniSigma", "year": 2025},
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    problem_response = client.post(
        "/problems",
        json={
            "statement_text": "Compute 1+1.",
            "sources": [
                {"source_id": source_id, "is_primary": True},
                {"source_id": source_id, "is_primary": False},
            ],
        },
    )

    assert problem_response.status_code == 422


def test_problem_rejects_multiple_primary_sources() -> None:
    client = TestClient(app)

    source_a = client.post("/sources", json={"title": "Source A"})
    source_b = client.post("/sources", json={"title": "Source B"})
    assert source_a.status_code == 201
    assert source_b.status_code == 201

    problem_response = client.post(
        "/problems",
        json={
            "statement_text": "Find all roots.",
            "sources": [
                {"source_id": source_a.json()["id"], "is_primary": True},
                {"source_id": source_b.json()["id"], "is_primary": True},
            ],
        },
    )

    assert problem_response.status_code == 422


def test_problem_auto_generates_latex_when_missing() -> None:
    client = TestClient(app)

    response = client.post(
        "/problems",
        json={
            "statement_text": "Integrate x^2 from 0 to 1.",
            "auto_generate_latex": True,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["statement_latex"] is not None
    assert "\\text{" in payload["statement_latex"]


def test_duplicate_problem_attaches_new_source_to_existing_problem() -> None:
    client = TestClient(app)

    source_a = client.post("/sources", json={"title": "Source A", "year": 2022})
    source_b = client.post("/sources", json={"title": "Source B", "year": 2020})
    assert source_a.status_code == 201
    assert source_b.status_code == 201

    first_problem = client.post(
        "/problems",
        json={
            "statement_text": "Find the value of x.",
            "sources": [{"source_id": source_a.json()["id"], "is_primary": True}],
        },
    )
    assert first_problem.status_code == 201
    first_problem_id = first_problem.json()["id"]

    second_submission = client.post(
        "/problems",
        json={
            "statement_text": "Find the value of x.",
            "sources": [{"source_id": source_b.json()["id"], "is_primary": True}],
        },
    )

    assert second_submission.status_code == 201
    assert second_submission.json()["id"] == first_problem_id
    source_titles = {
        link["source"]["title"] for link in second_submission.json()["sources"]
    }
    assert source_titles == {"Source A", "Source B"}
    primary_sources = [
        link for link in second_submission.json()["sources"] if link["is_primary"]
    ]
    assert len(primary_sources) == 1
    assert primary_sources[0]["source"]["title"] == "Source B"


def test_ocr_endpoint_rejects_non_image() -> None:
    client = TestClient(app)

    response = client.post(
        "/problems/ocr-latex",
        files={"file": ("notes.txt", b"not an image", "text/plain")},
    )

    assert response.status_code == 400


def test_ocr_endpoint_returns_latex_from_service(monkeypatch) -> None:
    client = TestClient(app)

    async def fake_extract_latex_from_image(**_kwargs) -> OcrExtractionResult:
        return OcrExtractionResult(
            latex=r"x^2 + y^2 = z^2",
            markdown=None,
            mode_used="formula",
            strategy="single-pass-formula",
        )

    monkeypatch.setattr(
        problems_routes,
        "extract_latex_from_image",
        fake_extract_latex_from_image,
    )

    response = client.post(
        "/problems/ocr-latex",
        files={"file": ("equation.png", b"fakepng", "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["latex"] == r"x^2 + y^2 = z^2"
    assert response.json()["markdown"] is None
    assert response.json()["mode_used"] == "formula"


def test_ocr_endpoint_rejects_invalid_mode() -> None:
    client = TestClient(app)

    response = client.post(
        "/problems/ocr-latex",
        data={"ocr_mode": "bad-mode"},
        files={"file": ("equation.png", b"fakepng", "image/png")},
    )

    assert response.status_code == 400


def test_ocr_endpoint_returns_page_mode_markdown(monkeypatch) -> None:
    client = TestClient(app)

    async def fake_extract_latex_from_image(**_kwargs) -> OcrExtractionResult:
        return OcrExtractionResult(
            latex="## Title\n\n$E = mc^2$",
            markdown="## Title\n\n$E = mc^2$",
            mode_used="page",
            strategy="page-resized-1280",
        )

    monkeypatch.setattr(
        problems_routes,
        "extract_latex_from_image",
        fake_extract_latex_from_image,
    )

    response = client.post(
        "/problems/ocr-latex",
        data={"ocr_mode": "page"},
        files={"file": ("worksheet.png", b"fakepng", "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode_used"] == "page"
    assert payload["markdown"] == "## Title\n\n$E = mc^2$"
    assert payload["latex"] == "## Title\n\n$E = mc^2$"
    assert payload["strategy"] == "page-resized-1280"


def test_ocr_endpoint_passes_normalized_mode_to_service(monkeypatch) -> None:
    client = TestClient(app)
    captured: dict[str, str] = {}

    async def fake_extract_latex_from_image(**kwargs) -> OcrExtractionResult:
        captured["mode_override"] = kwargs["mode_override"]
        return OcrExtractionResult(
            latex=r"x+y",
            markdown=None,
            mode_used="text_formula",
            strategy="text-formula-resized-1024",
        )

    monkeypatch.setattr(
        problems_routes,
        "extract_latex_from_image",
        fake_extract_latex_from_image,
    )

    response = client.post(
        "/problems/ocr-latex",
        data={"ocr_mode": " TeXt_FoRmUlA "},
        files={"file": ("equation.png", b"fakepng", "image/png")},
    )

    assert response.status_code == 200
    assert captured["mode_override"] == "text_formula"
