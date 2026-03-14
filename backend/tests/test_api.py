from fastapi.testclient import TestClient

from app.api.routes import problems as problems_routes
from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.services.pix2text_ocr import OcrExtractionResult, _parse_text_languages


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


def test_create_math_tags_and_list() -> None:
    client = TestClient(app)

    # Create math tags
    response1 = client.post(
        "/tags", json={"name": "algebra", "description": "Mathematics topic"}
    )
    assert response1.status_code == 201
    tag1 = response1.json()
    assert tag1["name"] == "algebra"
    assert tag1["description"] == "Mathematics topic"

    response2 = client.post(
        "/tags", json={"name": "geometry", "description": "Mathematics topic"}
    )
    assert response2.status_code == 201

    response3 = client.post(
        "/tags", json={"name": "calculus", "description": "Mathematics topic"}
    )
    assert response3.status_code == 201

    # List tags should be alphabetically sorted
    list_response = client.get("/tags")
    assert list_response.status_code == 200
    tags = list_response.json()
    names = [t["name"] for t in tags]
    assert names == ["algebra", "calculus", "geometry"]


def test_create_duplicate_math_tag() -> None:
    client = TestClient(app)

    payload = {"name": "algebra", "description": "Mathematics topic"}
    response = client.post("/tags", json=payload)
    assert response.status_code == 201

    # Attempt to create duplicate
    duplicate_response = client.post("/tags", json=payload)
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["detail"] == "Tag already exists"


def test_strip_whitespace_in_math_tag() -> None:
    client = TestClient(app)

    # Leading/trailing whitespace
    response = client.post(
        "/tags", json={"name": "  calculus  ", "description": "Mathematics topic"}
    )
    assert response.status_code == 201
    tag = response.json()
    assert tag["name"] == "calculus"  # whitespace stripped
    assert tag["description"] == "Mathematics topic"


def test_create_source() -> None:
    client = TestClient(app)

    payload = {
        "title": "  Mock Contest Paper  ",
        "author": "UniSigma",
        "year": 2025,
        "notes": "Used for testing",
    }
    response = client.post("/sources", json=payload)
    assert response.status_code == 201

    source = response.json()
    # Leading/trailing whitespace should be stripped from title
    assert source["title"] == "Mock Contest Paper"
    assert source["author"] == "UniSigma"
    assert source["year"] == 2025
    assert source["notes"] == "Used for testing"
    assert "id" in source


def test_list_sources_sorted() -> None:
    client = TestClient(app)

    # Create multiple sources
    sources = [
        {"title": "Geometry Handbook", "author": "Alice", "year": 2020, "notes": ""},
        {"title": "Algebra Basics", "author": "Bob", "year": 2018, "notes": ""},
        {"title": "Calculus Compendium", "author": "Carol", "year": 2022, "notes": ""},
    ]

    for s in sources:
        client.post("/sources", json=s)

    # List sources should be alphabetically by title
    response = client.get("/sources")
    assert response.status_code == 200
    data = response.json()
    titles = [s["title"] for s in data]
    assert titles == ["Algebra Basics", "Calculus Compendium", "Geometry Handbook"]


def test_problem_crud_flow2() -> None:
    client = TestClient(app)

    # ----------------------------
    # Create math tag
    # ----------------------------
    tag_response = client.post(
        "/tags", json={"name": "algebra", "description": "Mathematics topic"}
    )
    assert tag_response.status_code == 201
    tag_id = tag_response.json()["id"]

    # ----------------------------
    # Create source
    # ----------------------------
    source_response = client.post(
        "/sources",
        json={"title": "Mock Contest Paper", "author": "UniSigma", "year": 2025},
    )
    assert source_response.status_code == 201
    source_id = source_response.json()["id"]

    # ----------------------------
    # Create problem
    # ----------------------------
    problem_payload = {
        "statement_text": "Solve x^2 - 5x + 6 = 0.",
        "statement_latex": r"Solve x^2 - 5x + 6 = 0.",
        "tag_ids": [tag_id],
        "sources": [
            {"source_id": source_id, "note": "Primary source", "is_primary": True}
        ],
        "notes": "Sample problem",
        "moderation_status": "approved",
    }
    problem_response = client.post("/problems", json=problem_payload)
    assert problem_response.status_code == 201
    problem = problem_response.json()
    assert problem["statement_text"] == "Solve x^2 - 5x + 6 = 0."
    assert problem["tags"][0]["name"] == "algebra"
    assert problem["sources"][0]["source"]["title"] == "Mock Contest Paper"

    problem_id = problem["id"]

    # ----------------------------
    # Get problem
    # ----------------------------
    fetched_problem = client.get(f"/problems/{problem_id}")
    assert fetched_problem.status_code == 200
    data = fetched_problem.json()
    assert data["statement_text"] == problem_payload["statement_text"]
    assert data["tags"][0]["id"] == tag_id

    # ----------------------------
    # Update problem (text + tags)
    # ----------------------------
    new_tag_response = client.post(
        "/tags", json={"name": "geometry", "description": "Mathematics topic"}
    )
    new_tag_id = new_tag_response.json()["id"]

    update_payload = {
        "statement_text": "Solve x^2 - 3x + 2 = 0.",
        "tag_ids": [new_tag_id],
        "sources": [],
    }
    updated_response = client.patch(f"/problems/{problem_id}", json=update_payload)
    assert updated_response.status_code == 200
    updated = updated_response.json()
    assert updated["statement_text"] == "Solve x^2 - 3x + 2 = 0."
    assert updated["tags"][0]["name"] == "geometry"
    assert updated["sources"] == []

    # ----------------------------
    # Create solution
    # ----------------------------
    solution_payload = {
        "body_text": "Factor into (x-1)(x-2)=0.",
        "body_latex": r"(x-1)(x-2)=0",
        "notes": "Simple factoring",
        "moderation_status": "approved",
    }
    solution_response = client.post(
        f"/problems/{problem_id}/solutions", json=solution_payload
    )
    assert solution_response.status_code == 201
    solution = solution_response.json()
    assert solution["body_text"] == solution_payload["body_text"]
    assert solution["notes"] == solution_payload["notes"]

    # ----------------------------
    # Get problem again (check solution attached)
    # ----------------------------
    final_problem = client.get(f"/problems/{problem_id}").json()
    assert final_problem["solutions"][0]["body_text"] == "Factor into (x-1)(x-2)=0."


def test_problem_404_for_missing_tag() -> None:
    client = TestClient(app)

    # Attempt to create a problem with non-existent tag
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [999],  # invalid
        "sources": [],
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "One or more tags were not found"


def test_problem_404_for_missing_source() -> None:
    client = TestClient(app)

    # Create valid tag
    tag_response = client.post(
        "/tags", json={"name": "calculus", "description": "Mathematics topic"}
    )
    tag_id = tag_response.json()["id"]

    # Attempt to create a problem with non-existent source
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [tag_id],
        "sources": [{"source_id": 999, "note": "", "is_primary": True}],  # invalid
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 404
    assert "Sources not found: 999" == response.json()["detail"]


# many many error cases
def test_tag_empty_name() -> None:
    client = TestClient(app)
    response = client.post("/tags", json={"name": "", "description": "Math topic"})
    assert response.status_code in (400, 422)


def test_tag_whitespace_name() -> None:
    client = TestClient(app)
    response = client.post("/tags", json={"name": "   ", "description": "Math topic"})
    assert response.status_code in (400, 422)


def test_tag_duplicate_name() -> None:
    client = TestClient(app)
    client.post("/tags", json={"name": "algebra", "description": "Math topic"})
    duplicate = client.post(
        "/tags", json={"name": "algebra", "description": "Math topic"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Tag already exists"


def test_source_empty_title() -> None:
    client = TestClient(app)
    response = client.post(
        "/sources", json={"title": "", "author": "Alice", "year": 2025}
    )
    assert response.status_code in (400, 422)


def test_source_whitespace_title() -> None:
    client = TestClient(app)
    response = client.post(
        "/sources", json={"title": "   ", "author": "Alice", "year": 2025}
    )
    assert response.status_code in (400, 422)


def test_source_missing_optional_notes() -> None:
    client = TestClient(app)
    response = client.post(
        "/sources", json={"title": "Calculus Book", "author": "Bob", "year": 2020}
    )
    assert response.status_code == 201
    source = response.json()
    assert source["notes"] is None or source["notes"] == ""


def test_problem_missing_tags() -> None:
    client = TestClient(app)
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [],  # No tags
        "sources": [],
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 201
    problem = response.json()
    assert problem["tags"] == []


def test_problem_missing_sources() -> None:
    client = TestClient(app)
    tag = client.post(
        "/tags", json={"name": "geometry", "description": "Math topic"}
    ).json()
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [tag["id"]],
        "sources": [],  # No sources
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 201
    problem = response.json()
    assert problem["sources"] == []


def test_problem_invalid_tag_id() -> None:
    client = TestClient(app)
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [999],  # Non-existent tag
        "sources": [],
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "One or more tags were not found"


def test_problem_invalid_source_id() -> None:
    client = TestClient(app)
    tag = client.post(
        "/tags", json={"name": "calculus", "description": "Math topic"}
    ).json()
    payload = {
        "statement_text": "Test problem",
        "statement_latex": "Test problem",
        "tag_ids": [tag["id"]],
        "sources": [
            {"source_id": 999, "note": "", "is_primary": True}
        ],  # Invalid source
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post("/problems", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Sources not found: 999"


def test_problem_update_nonexistent() -> None:
    client = TestClient(app)
    payload = {"statement_text": "Updated text"}
    response = client.patch("/problems/999", json=payload)
    assert response.status_code == 404
    assert response.json()["detail"] == "Problem not found"


def test_solution_empty_body() -> None:
    client = TestClient(app)
    tag = client.post(
        "/tags", json={"name": "algebra2", "description": "Math topic"}
    ).json()
    problem = client.post(
        "/problems",
        json={
            "statement_text": "x^2 = 4",
            "statement_latex": "x^2 = 4",
            "tag_ids": [tag["id"]],
            "sources": [],
            "notes": "",
            "moderation_status": "pending",
        },
    ).json()

    payload = {
        "body_text": "",
        "body_latex": "",
        "notes": "",
        "moderation_status": "pending",
    }
    response = client.post(f"/problems/{problem['id']}/solutions", json=payload)
    assert response.status_code in (400, 422)


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


def test_ocr_endpoint_rejects_invalid_engine() -> None:
    client = TestClient(app)

    response = client.post(
        "/problems/ocr-latex",
        data={"ocr_engine": "bad-engine"},
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
        captured["ocr_engine_override"] = kwargs["ocr_engine_override"]
        captured["ocr_server_type_override"] = kwargs["ocr_server_type_override"]
        captured["ocr_language_override"] = kwargs["ocr_language_override"]
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
        data={
            "ocr_mode": " TeXt_FoRmUlA ",
            "ocr_engine": " ClOuD ",
            "ocr_server_type": " PlUs ",
            "ocr_language": " English ",
        },
        files={"file": ("equation.png", b"fakepng", "image/png")},
    )

    assert response.status_code == 200
    assert captured["mode_override"] == "text_formula"
    assert captured["ocr_engine_override"] == "cloud"
    assert captured["ocr_server_type_override"] == "plus"
    assert captured["ocr_language_override"] == "English"


def test_parse_text_languages_defaults_to_en() -> None:
    assert _parse_text_languages(" , ") == ("en",)


def test_parse_text_languages_strips_and_preserves_order() -> None:
    assert _parse_text_languages(" en , ch_sim,ja ") == ("en", "ch_sim", "ja")


# testing similarity feature
def test_similar_endpoint_returns_404_for_missing_problem() -> None:
    client = TestClient(app)
    response = client.get("/problems/999/similar")
    assert response.status_code == 404
    assert response.json()["detail"] == "Problem not found"


def test_similar_endpoint_returns_empty_for_problem_without_embedding() -> None:
    client = TestClient(app)

    # Create a problem without embedding
    payload = {"statement_text": "No embedding problem"}
    response = client.post("/problems", json=payload)
    problem_id = response.json()["id"]

    similar_response = client.get(f"/problems/{problem_id}/similar")
    assert similar_response.status_code == 200
    assert similar_response.json() == []


def test_similar_endpoint_returns_relevant_problems() -> None:
    client = TestClient(app)

    # Clear DB
    setup_function()

    # Create several problems
    problems = [
        "Derivative of x^2",
        "Integral of x^2",
        "Derivative of x^3",
        "Solve x^2 + 2x + 1 = 0",
        "Find limit of x->0 of sin(x)/x",
    ]
    problem_ids = []

    for text in problems:
        response = client.post("/problems", json={"statement_text": text})
        assert response.status_code == 201
        problem_ids.append(response.json()["id"])

    main_problem_id = problem_ids[0]  # "Derivative of x^2"

    # Call similar endpoint
    similar_response = client.get(f"/problems/{main_problem_id}/similar")
    assert similar_response.status_code == 200
    similar = similar_response.json()

    similar_texts = [p["statement_text"] for p in similar]

    # Exclude self
    assert "Derivative of x^2" not in similar_texts
    # Closely related problem should appear
    assert "Derivative of x^3" in similar_texts
    # At most return 4 results
    assert len(similar_texts) <= 4
