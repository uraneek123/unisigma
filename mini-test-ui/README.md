# Minimal Test UI

This is a tiny static frontend used only for testing backend functionality.

## Run

1. Start backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

2. In another terminal, serve this folder:

```powershell
cd mini-test-ui
python -m http.server 5501
```

3. Open:

`http://127.0.0.1:5501`

## What it tests

- OCR upload (`POST /problems/ocr-latex`) with:
  - `ocr_mode` (`auto/formula/text_formula/page`)
  - `ocr_engine` (`default/local/cloud`)
  - cloud overrides (`ocr_server_type`, `ocr_language`)
- Create problem
- List problems
- Upload PNG diagram to a problem

PNG upload endpoint used:

- `POST /problems/{problem_id}/diagrams`
