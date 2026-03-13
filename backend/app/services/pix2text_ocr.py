from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Any

from PIL import Image

from app.core.config import Settings

_p2t_instance: Any | None = None


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
) -> OcrExtractionResult:
    p2t = _get_p2t_instance()
    normalized_image_bytes = _normalize_image_bytes_to_rgb_png(image_bytes)
    prepared_image_bytes = _rescale_for_ocr(normalized_image_bytes)

    with NamedTemporaryFile(suffix=_get_suffix(filename), delete=False) as temp_file:
        temp_file.write(prepared_image_bytes)
        image_path = Path(temp_file.name)

    try:
        if mode_override is None:
            mode_source = settings.pix2text_mode
        else:
            mode_source = mode_override
        mode = mode_source.strip().lower()
        if mode not in {"auto", "formula", "text_formula", "page"}:
            mode = "auto"

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
