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
- `POST /accounts`
- `GET /accounts` (admin only; requires `actor_user_id`)
- `GET /accounts/{account_id}` (admin or self; requires `actor_user_id`)
- `PATCH /accounts/{account_id}` (admin only; requires `actor_user_id`)
- `GET /problems`
- `POST /problems`
- `GET /problems/{problem_id}`
- `PATCH /problems/{problem_id}` (requires `actor_user_id`)
- `PATCH /problems/{problem_id}/moderation` (moderator/admin; requires `actor_user_id`)
- `GET /problems/{problem_id}/similar`
- `POST /problems/assets` (upload editor snippet image and get markdown token)
- `POST /problems/ocr-latex` (Pix2Text image -> LaTeX)
- `POST /problems/ocr-text` (dedicated text OCR with `tesseract`/`pix2text`)
- `POST /problems/{problem_id}/diagrams` (PNG only)
- `POST /problems/{problem_id}/solutions`

Account/auth notes:

- Account roles: `user`, `moderator`, `admin`.
- First created account is automatically promoted to `admin`.
- Passwords are optional; if provided, they are stored as salted `scrypt` hashes (not plaintext).
- `actor_user_id` query param is used as lightweight actor context for permission checks.

Problem submission notes:

- `POST /problems` supports markdown-first authoring:
  - `content_markdown`: full editor output (text + math + embedded image markdown)
  - `statement_text`: optional short title/summary
  - `notes`: worked description / explanation
- If `statement_text` is omitted, backend derives one from markdown content.
- `POST /problems` supports `auto_generate_latex`.
- If `statement_latex` is omitted and `auto_generate_latex=true`, backend stores a generated LaTeX fallback.
- `suggested_tag_names` can create missing tags automatically.
- `suggested_sources` can create missing sources automatically and attach them.
- Duplicate problem statements are merged into the existing problem and new sources/tags are attached.
- Problem author can be assigned via `author_id` or inferred from `submitted_by`.
- Author stats are tracked on account (`questions_posted`, `score`).
- Similarity ranking prioritizes tag overlap, with embedding cosine as a secondary signal.

Math OCR setup (Pix2Text):

- Install backend dependencies (includes `pix2text`).
- Optional in `backend/.env`: `PIX2TEXT_MODE=formula` or `PIX2TEXT_MODE=text_formula`.
- Then call `POST /problems/ocr-latex` with multipart form field `file`.
- Optional multipart field `ocr_mode`: `auto`, `formula`, `text_formula`, or `page`.
- Optional multipart field `ocr_engine`: `default`, `local`, or `cloud`.
- Optional multipart field `ocr_server_type` (cloud only): `pro`, `plus`, or `ultra`.
- Optional multipart field `ocr_language` (cloud only): e.g. `English`.
- Optional multipart field `strip_math_delimiters`: `true/false`.
  - For snippet workflow, set `true` so formula results return raw math without wrapping `$...$` or `$$...$$`.
- PDF input is supported only with cloud OCR and `ocr_server_type=ultra`.
- OCR response includes `latex`, optional `markdown`, `mode_used`, and `strategy`.

Text OCR setup:

- `POST /problems/ocr-text` with multipart `file`.
- Optional multipart fields:
  - `text_tool`: `auto`, `tesseract`, `pix2text`
  - `ocr_engine`: `default`, `local`, `cloud` (used by `pix2text`)
  - `ocr_server_type`: `pro`, `plus`, `ultra` (cloud `pix2text`)
  - `ocr_language`: e.g. `English`
  - `strip_cjk`: `true/false` to remove CJK characters from OCR output
- Response includes `text` and `strategy`.

Editor asset upload:

- `POST /problems/assets` with multipart `file` and optional `alt_text`.
- Response contains:
  - `image_path`: relative web path under `/uploads/...`
  - `image_url`: absolute URL for direct browser rendering
  - `markdown_image`: ready-to-paste markdown image token (uses `image_url`).
- Backend serves uploads at `/uploads/*` for browser rendering.

Cloud OCR env vars (Breezedeus):

- `PIX2TEXT_PROVIDER=local` or `PIX2TEXT_PROVIDER=cloud` (default provider when `ocr_engine=default`)
- `PIX2TEXT_CLOUD_API_KEY=...` (required for cloud OCR)
- `PIX2TEXT_CLOUD_BASE_URL=https://api.breezedeus.com`
- `PIX2TEXT_CLOUD_LANGUAGE=English`
- `PIX2TEXT_CLOUD_SERVER_TYPE=pro`
- `PIX2TEXT_CLOUD_POLL_INTERVAL_SECONDS=2.0`
- `PIX2TEXT_CLOUD_POLL_TIMEOUT_SECONDS=90.0`
