from __future__ import annotations

import asyncio
import mimetypes
import time
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Any

from PIL import Image

from app.core.config import Settings

_p2t_instance: Any | None = None
_OCR_MODES = {"auto", "formula", "text_formula", "page"}
_CLOUD_SERVER_TYPES = {"pro", "plus", "ultra"}


@dataclass
class OcrExtractionResult:
    latex: str
    markdown: str | None
    mode_used: str
    strategy: str


def _extract_latex_from_text_formula_result(result: Any) -> str:
    if isinstance(result, str) and result.strip():
        return result.strip()

    if isinstance(result, list):
        parts: list[str] = []
        for item in result:
            if isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str) and text.strip():
                    parts.append(text.strip())
            elif isinstance(item, str) and item.strip():
                parts.append(item.strip())

        joined = " ".join(parts).strip()
        if joined:
            return joined

    raise RuntimeError("Pix2Text did not return recognizable LaTeX output")


def _parse_text_languages(raw_languages: str) -> tuple[str, ...]:
    languages = tuple(
        token.strip() for token in raw_languages.split(",") if token.strip()
    )
    return languages if languages else ("en",)


def _normalize_ocr_mode(mode_source: str) -> str:
    mode = mode_source.strip().lower()
    if mode in _OCR_MODES:
        return mode
    return "auto"


def _resolve_ocr_provider(
    settings: Settings, ocr_engine_override: str | None = None
) -> str:
    if ocr_engine_override is None:
        candidate = settings.pix2text_provider
    else:
        normalized_override = ocr_engine_override.strip().lower()
        if normalized_override in {"", "default"}:
            candidate = settings.pix2text_provider
        else:
            candidate = normalized_override

    if candidate in {"local", "cloud"}:
        return candidate
    return "local"


def _resolve_cloud_server_type(
    settings: Settings, ocr_server_type_override: str | None = None
) -> str:
    if ocr_server_type_override is None:
        candidate = settings.pix2text_cloud_server_type
    else:
        candidate = ocr_server_type_override.strip().lower()
    if candidate in _CLOUD_SERVER_TYPES:
        return candidate
    return settings.pix2text_cloud_server_type


def _map_mode_for_cloud(mode: str) -> str:
    if mode == "auto":
        return "text_formula"
    return mode


def _extract_cloud_text(payload: Any) -> str:
    collected: list[str] = []

    def collect(value: Any) -> None:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                collected.append(stripped)
            return
        if isinstance(value, list):
            for item in value:
                collect(item)
            return
        if isinstance(value, dict):
            preferred_keys = (
                "latex",
                "text",
                "markdown",
                "md",
                "content",
                "result",
                "results",
            )
            for key in preferred_keys:
                if key in value:
                    collect(value[key])

    collect(payload)
    if not collected:
        return ""
    return "\n\n".join(collected)


def _build_cloud_error_message(status_code: int, response_text: str) -> str:
    if status_code == 401:
        return "Breezedeus OCR rejected the API key (401)."
    if status_code == 403:
        return "Breezedeus OCR quota is insufficient (403)."
    if status_code == 400:
        return "Breezedeus OCR rejected the request (400)."
    if status_code >= 500:
        return "Breezedeus OCR server error."
    detail = response_text.strip()
    if not detail:
        return f"Breezedeus OCR request failed with status {status_code}."
    return f"Breezedeus OCR request failed ({status_code}): {detail}"


def _normalize_api_path(path: str) -> str:
    stripped = path.strip()
    if not stripped:
        return "/"
    if not stripped.startswith("/"):
        stripped = f"/{stripped}"
    return stripped.rstrip("/") or "/"


def _build_cloud_url(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}{_normalize_api_path(path)}"


def _candidate_submit_paths(settings: Settings) -> tuple[str, ...]:
    primary = _normalize_api_path(settings.pix2text_cloud_submit_path)
    candidates: list[str] = [primary]
    if primary == "/pix2text":
        candidates.append("/api/pix2text")
    elif primary == "/api/pix2text":
        candidates.append("/pix2text")
    return tuple(dict.fromkeys(candidates))


def _result_path_for_submit_path(settings: Settings, submit_path: str) -> str:
    template = settings.pix2text_cloud_result_path_template.strip()
    if not template:
        template = "/result/{task_id}"
    normalized_template = _normalize_api_path(template)
    if normalized_template == "/result/{task_id}" and _normalize_api_path(
        submit_path
    ).startswith("/api/"):
        return "/api/result/{task_id}"
    return normalized_template


async def _extract_latex_from_image_cloud(
    image_bytes: bytes,
    filename: str,
    mode: str,
    settings: Settings,
    ocr_language_override: str | None = None,
    ocr_server_type_override: str | None = None,
) -> OcrExtractionResult:
    api_key = (settings.pix2text_cloud_api_key or "").strip()
    if not api_key:
        raise RuntimeError(
            "Cloud OCR key is missing. Set PIX2TEXT_CLOUD_API_KEY in backend/.env."
        )

    try:
        import httpx
    except ImportError as exc:
        raise RuntimeError(
            "httpx is required for cloud OCR. Install dependencies and retry."
        ) from exc

    cloud_mode = _map_mode_for_cloud(mode)
    language = (
        ocr_language_override.strip()
        if ocr_language_override and ocr_language_override.strip()
        else settings.pix2text_cloud_language
    )
    server_type = _resolve_cloud_server_type(settings, ocr_server_type_override)
    if filename.lower().endswith(".pdf") and server_type != "ultra":
        raise RuntimeError(
            "PDF OCR requires server_type=ultra for Breezedeus cloud OCR."
        )

    guessed_content_type = (
        mimetypes.guess_type(filename)[0] or "application/octet-stream"
    )
    base_url = settings.pix2text_cloud_base_url.rstrip("/")
    headers = {"X-API-Key": api_key}
    submit_payload = {
        "language": language,
        "file_type": cloud_mode,
        "server_type": server_type,
    }

    timeout = httpx.Timeout(30.0, connect=15.0, read=30.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        submit_response = None
        submit_path_used = ""
        submit_paths = _candidate_submit_paths(settings)
        for submit_path in submit_paths:
            candidate_response = await client.post(
                _build_cloud_url(base_url, submit_path),
                headers=headers,
                data=submit_payload,
                files={"image": (filename, image_bytes, guessed_content_type)},
            )
            submit_response = candidate_response
            submit_path_used = submit_path
            if candidate_response.status_code not in {404, 405}:
                break

        assert submit_response is not None
        if submit_response.status_code >= 400:
            message = _build_cloud_error_message(
                submit_response.status_code,
                submit_response.text,
            )
            if submit_response.status_code in {404, 405} and len(submit_paths) > 1:
                attempted = ", ".join(submit_paths)
                message = (
                    f"{message} Tried submit paths: {attempted}. "
                    "Set PIX2TEXT_CLOUD_SUBMIT_PATH if your API uses a different path."
                )
            raise RuntimeError(message)

        submit_result = submit_response.json()
        task_id = str(submit_result.get("task_id", "")).strip()

        if not task_id:
            direct_text = _extract_cloud_text(
                submit_result.get("results", submit_result)
            )
            if not direct_text:
                raise RuntimeError(
                    "Breezedeus OCR returned no task_id and no result text."
                )
            return OcrExtractionResult(
                latex=direct_text,
                markdown=direct_text if cloud_mode == "page" else None,
                mode_used=cloud_mode,
                strategy=f"cloud-{server_type}-direct",
            )

        deadline = time.monotonic() + max(
            5.0,
            settings.pix2text_cloud_poll_timeout_seconds,
        )
        result_payload: dict[str, Any] | None = None
        result_path = _result_path_for_submit_path(settings, submit_path_used)
        result_url = _build_cloud_url(
            base_url,
            result_path.format(task_id=task_id),
        )
        fallback_result_url: str | None = None
        if result_path == "/api/result/{task_id}":
            fallback_result_url = _build_cloud_url(base_url, f"/result/{task_id}")
        elif result_path == "/result/{task_id}":
            fallback_result_url = _build_cloud_url(base_url, f"/api/result/{task_id}")
        poll_interval = max(0.2, settings.pix2text_cloud_poll_interval_seconds)

        while time.monotonic() < deadline:
            poll_response = await client.get(result_url, headers=headers)
            if (
                poll_response.status_code in {404, 405}
                and fallback_result_url is not None
            ):
                result_url, fallback_result_url = fallback_result_url, None
                continue
            if poll_response.status_code >= 400:
                raise RuntimeError(
                    _build_cloud_error_message(
                        poll_response.status_code,
                        poll_response.text,
                    )
                )

            payload = poll_response.json()
            status = str(payload.get("status", "")).strip().upper()
            if status in {"FINISHED", "SUCCESS", "DONE"}:
                result_payload = payload
                break
            if status in {"FAILED", "ERROR", "CANCELED"}:
                detail = payload.get("message") or payload.get("detail") or status
                raise RuntimeError(f"Breezedeus OCR task failed: {detail}")

            await asyncio.sleep(poll_interval)

        if result_payload is None:
            raise RuntimeError("Timed out waiting for Breezedeus OCR task result.")

        content = result_payload.get("results", result_payload)
        extracted_text = _extract_cloud_text(content)
        if not extracted_text:
            raise RuntimeError("Breezedeus OCR returned an empty result.")

        return OcrExtractionResult(
            latex=extracted_text,
            markdown=extracted_text if cloud_mode == "page" else None,
            mode_used=cloud_mode,
            strategy=f"cloud-{server_type}-poll",
        )


def _get_p2t_instance() -> Any:
    global _p2t_instance
    if _p2t_instance is not None:
        return _p2t_instance

    try:
        from pix2text import Pix2Text
    except ImportError as exc:
        raise RuntimeError(
            "Pix2Text is not installed. Install dependencies and retry."
        ) from exc

    _p2t_instance = Pix2Text.from_config()
    return _p2t_instance


def _get_suffix(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix if suffix else ".png"


def _normalize_image_bytes_to_rgb_png(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            rgb_image = image.convert("RGB")
            out = BytesIO()
            rgb_image.save(out, format="PNG")
            return out.getvalue()
    except Exception as exc:
        raise RuntimeError("Unable to decode image for OCR") from exc


def _rescale_for_ocr(image_bytes: bytes) -> bytes:
    with Image.open(BytesIO(image_bytes)) as image:
        width, height = image.size
        if width >= 900:
            return image_bytes

        scale = 900 / max(width, 1)
        new_size = (max(1, int(width * scale)), max(1, int(height * scale)))
        resized = image.resize(new_size, Image.Resampling.LANCZOS)
        out = BytesIO()
        resized.save(out, format="PNG")
        return out.getvalue()


def _latex_quality_score(latex: str) -> float:
    score = 0.0
    cleaned = latex.strip()
    if not cleaned:
        return -1.0

    score += min(len(cleaned) / 16.0, 8.0)
    score += cleaned.count("\\") * 0.8
    score += cleaned.count("^") * 0.5
    score += cleaned.count("_") * 0.5
    score += cleaned.count("{") * 0.2
    score -= cleaned.lower().count("unknown") * 1.5
    score -= cleaned.count("?") * 0.4
    return score


def _markdown_quality_score(markdown: str) -> float:
    score = min(len(markdown.strip()) / 40.0, 10.0)
    score += markdown.count("$") * 0.5
    score += markdown.count("\\") * 0.4
    score += markdown.count("#") * 0.2
    return score


def _run_formula_ocr(image_path: Path, p2t: Any) -> str | None:
    result = p2t.recognize_formula(str(image_path))
    if isinstance(result, str) and result.strip():
        return result.strip()
    return None


def _run_text_formula_ocr(image_path: Path, p2t: Any, resized_shape: int) -> str | None:
    result = p2t.recognize_text_formula(
        str(image_path),
        resized_shape=resized_shape,
        return_text=True,
        auto_line_break=False,
    )
    extracted = _extract_latex_from_text_formula_result(result)
    return extracted.strip() if extracted else None


def _extract_markdown_from_page_result(result: Any) -> str:
    if isinstance(result, str) and result.strip():
        return result.strip()

    to_markdown = getattr(result, "to_markdown", None)
    if callable(to_markdown):
        with TemporaryDirectory() as temp_dir:
            rendered = to_markdown(temp_dir)
            if isinstance(rendered, str) and rendered.strip() and "\n" in rendered:
                return rendered.strip()

            markdown_candidates = [
                Path(temp_dir) / "output.md",
                Path(temp_dir) / "output" / "output.md",
            ]
            for candidate in markdown_candidates:
                if candidate.exists():
                    return candidate.read_text(encoding="utf-8").strip()

    text_attr = getattr(result, "text", None)
    if isinstance(text_attr, str) and text_attr.strip():
        return text_attr.strip()

    raise RuntimeError("Pix2Text page recognition did not return markdown output")


def _run_page_ocr(image_path: Path, p2t: Any, resized_shape: int) -> str | None:
    result = p2t.recognize(
        str(image_path),
        file_type="page",
        resized_shape=resized_shape,
        auto_line_break=True,
        text_contain_formula=True,
        title_contain_formula=True,
    )
    markdown = _extract_markdown_from_page_result(result)
    return markdown.strip() if markdown else None


async def extract_latex_from_image(
    image_bytes: bytes,
    filename: str,
    settings: Settings,
    mode_override: str | None = None,
    ocr_engine_override: str | None = None,
    ocr_language_override: str | None = None,
    ocr_server_type_override: str | None = None,
) -> OcrExtractionResult:
    mode_source = settings.pix2text_mode if mode_override is None else mode_override
    mode = _normalize_ocr_mode(mode_source)
    ocr_provider = _resolve_ocr_provider(settings, ocr_engine_override)

    if ocr_provider == "cloud":
        return await _extract_latex_from_image_cloud(
            image_bytes=image_bytes,
            filename=filename,
            mode=mode,
            settings=settings,
            ocr_language_override=ocr_language_override,
            ocr_server_type_override=ocr_server_type_override,
        )

    p2t = _get_p2t_instance()
    normalized_image_bytes = _normalize_image_bytes_to_rgb_png(image_bytes)
    prepared_image_bytes = _rescale_for_ocr(normalized_image_bytes)

    with NamedTemporaryFile(suffix=_get_suffix(filename), delete=False) as temp_file:
        temp_file.write(prepared_image_bytes)
        image_path = Path(temp_file.name)

    try:
        candidates: list[tuple[float, OcrExtractionResult]] = []

        if mode in {"auto", "formula"}:
            formula_latex = _run_formula_ocr(image_path, p2t)
            if formula_latex:
                candidates.append(
                    (
                        _latex_quality_score(formula_latex),
                        OcrExtractionResult(
                            latex=formula_latex,
                            markdown=None,
                            mode_used="formula",
                            strategy="single-pass-formula",
                        ),
                    )
                )

        if mode in {"auto", "text_formula"}:
            for resized_shape in (768, 1024):
                text_formula_latex = _run_text_formula_ocr(
                    image_path,
                    p2t,
                    resized_shape=resized_shape,
                )
                if text_formula_latex:
                    candidates.append(
                        (
                            _latex_quality_score(text_formula_latex),
                            OcrExtractionResult(
                                latex=text_formula_latex,
                                markdown=None,
                                mode_used="text_formula",
                                strategy=f"text-formula-resized-{resized_shape}",
                            ),
                        )
                    )

        if mode in {"auto", "page"}:
            for resized_shape in (1024, 1280):
                page_markdown = _run_page_ocr(
                    image_path,
                    p2t,
                    resized_shape=resized_shape,
                )
                if page_markdown:
                    candidates.append(
                        (
                            _markdown_quality_score(page_markdown),
                            OcrExtractionResult(
                                latex=page_markdown,
                                markdown=page_markdown,
                                mode_used="page",
                                strategy=f"page-resized-{resized_shape}",
                            ),
                        )
                    )

        if not candidates:
            raise RuntimeError("Pix2Text returned no recognizable output")

        candidates.sort(key=lambda item: item[0], reverse=True)
        return candidates[0][1]
    finally:
        image_path.unlink(missing_ok=True)
