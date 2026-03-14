# Mini Test Frontend

This UI now has **3 test pages**:

- `View Problems`
- `Create Problem` (composer workflow)
- `Edit / Admin` (problem updates + moderation + tag/account tools)

## Run

1. Start backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

2. Serve this folder:

```powershell
cd mini-test-ui
python -m http.server 5501
```

3. Open:

`http://127.0.0.1:5501`

## What This Mock UI Tests

### View Problems page

- List/filter problems
- Inspect selected problem metadata + rendered content
- Query similar problems

### Create Problem page

- Multiple source image upload and switching
- Drag-selection snippet capture from active source image
- Per-snippet OCR options:
  - `tool`: `math` (LaTeX OCR) or `text` (dedicated text OCR endpoint)
  - `mode`: `formula`, `text_formula`, `page`, `auto`
  - `engine`: `default`, `local`, `cloud`
  - cloud server/language controls
  - `strip_math_delimiters`
  - `text backend`: `auto`, `tesseract`, `pix2text`
  - `strip_cjk` toggle for noisy CJK output cleanup
- Snippet kinds:
  - `inline_math`
  - `block_math`
  - `plain_text`
- Editable snippet content panel:
  - OCR output can be manually corrected per snippet before insertion
- Custom token editor:
  - token insertion: `[snippet N]`
  - draggable block list (`text`, `snippet token`, `image`)
- Composer submission to backend:
  - `POST /problems` with `content_markdown`
  - snippet image uploads via `POST /problems/assets`
  - text OCR calls via `POST /problems/ocr-text`

### Edit / Admin page

- Load and patch existing problems (`statement_text`, `notes`, `content_markdown`, `tag_ids`, optional moderation field)
- Apply moderation actions (`/problems/{id}/moderation`)
- Query similar problems for the loaded problem
- Create/list tags
- List/update accounts (admin endpoint, requires `actor_user_id` for admin account)

## Frontend Structure (More Testable)

- [index.html](/c:/Files/Temporary%20Code/UniSigma/mini-test-ui/index.html)
  - UI markup only + stylesheet + script includes
- [app.js](/c:/Files/Temporary%20Code/UniSigma/mini-test-ui/js/app.js)
  - app state, UI orchestration, event handling
- [api-client.js](/c:/Files/Temporary%20Code/UniSigma/mini-test-ui/js/api-client.js)
  - backend API calls
- [composer-store.js](/c:/Files/Temporary%20Code/UniSigma/mini-test-ui/js/composer-store.js)
  - pure block operations
- [editor-utils.js](/c:/Files/Temporary%20Code/UniSigma/mini-test-ui/js/editor-utils.js)
  - markdown+math rendering and selection helpers
