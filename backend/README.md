From the `backend` folder:

```powershell
uv sync
uv run uvicorn app.main:app --reload
```

If Pix2Text install fails in Python 3.14, use Python 3.12:

```powershell
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install --upgrade pip
.\.venv312\Scripts\python.exe -m pip install fastapi pydantic-settings python-multipart sqlalchemy "uvicorn[standard]" pytest ruff httpx pix2text
.\.venv312\Scripts\python.exe -m uvicorn app.main:app --reload
```

Bare-bones API right now:

- `GET /`
- `GET /health`
- `GET /tags`
- `POST /tags`
- `GET /sources`
- `POST /sources`
- `GET /problems`
- `POST /problems`
- `GET /problems/{problem_id}`
- `PATCH /problems/{problem_id}`
- `PATCH /problems/{problem_id}/moderation`
- `POST /problems/ocr-latex` (Pix2Text image -> LaTeX)
- `POST /problems/{problem_id}/diagrams` (PNG only)
- `POST /problems/{problem_id}/solutions`

Problem submission notes:

- `POST /problems` supports `auto_generate_latex`.
- If `statement_latex` is omitted and `auto_generate_latex=true`, backend stores a generated LaTeX fallback.
- `suggested_tag_names` can create missing tags automatically.
- `suggested_sources` can create missing sources automatically and attach them.
- Duplicate problem statements are merged into the existing problem and new sources/tags are attached.

Math OCR setup (Pix2Text):

- Install backend dependencies (includes `pix2text`).
- Optional in `backend/.env`: `PIX2TEXT_MODE=formula` or `PIX2TEXT_MODE=text_formula`.
- Then call `POST /problems/ocr-latex` with multipart form field `file`.
- Optional multipart field `ocr_mode`: `auto`, `formula`, `text_formula`, or `page`.
- Optional multipart field `ocr_engine`: `default`, `local`, or `cloud`.
- Optional multipart field `ocr_server_type` (cloud only): `pro`, `plus`, or `ultra`.
- Optional multipart field `ocr_language` (cloud only): e.g. `English`.
- PDF input is supported only with cloud OCR and `ocr_server_type=ultra`.
- OCR response includes `latex`, optional `markdown`, `mode_used`, and `strategy`.

Cloud OCR env vars (Breezedeus):

- `PIX2TEXT_PROVIDER=local` or `PIX2TEXT_PROVIDER=cloud` (default provider when `ocr_engine=default`)
- `PIX2TEXT_CLOUD_API_KEY=...` (required for cloud OCR)
- `PIX2TEXT_CLOUD_BASE_URL=https://api.breezedeus.com`
- `PIX2TEXT_CLOUD_LANGUAGE=English`
- `PIX2TEXT_CLOUD_SERVER_TYPE=pro`
- `PIX2TEXT_CLOUD_POLL_INTERVAL_SECONDS=2.0`
- `PIX2TEXT_CLOUD_POLL_TIMEOUT_SECONDS=90.0`
