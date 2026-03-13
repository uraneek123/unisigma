From the `backend` folder:

```powershell
uv sync
uv run uvicorn app.main:app --reload
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
- `POST /problems/{problem_id}/solutions`
