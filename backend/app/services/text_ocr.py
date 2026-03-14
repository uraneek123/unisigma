from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from typing import Literal

from PIL import Image

from app.core.config import Settings
from app.services.pix2text_ocr import extract_latex_from_image

_TEXT_OCR_TOOLS = {"auto", "tesseract", "pix2text"}
_CJK_CHAR_PATTERN = re.compile(
    r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\u31F0-\u31FF\uAC00-\uD7AF]"
)
_LANGUAGE_TO_TESSERACT = {
    "english": "eng",
    "simplified chinese": "chi_sim",
    "traditional chinese": "chi_tra",
    "hindi": "hin",
    "spanish": "spa",
    "vietnamese": "vie",
    "german": "deu",
    "danish": "dan",
    "italian": "ita",
    "french": "fra",
    "russian": "rus",
}


@dataclass
class TextExtractionResult:
    text: str
    strategy: str


def _normalize_tool(
    text_tool_override: str | None,
) -> Literal["auto", "tesseract", "pix2text"]:
    if text_tool_override is None:
        return "auto"
    normalized = text_tool_override.strip().lower()
    if normalized in _TEXT_OCR_TOOLS:
        return normalized  # type: ignore[return-value]
    return "auto"


def _normalize_whitespace(text: str) -> str:
    normalized = text.replace("\r\n", "\n")
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return "\n".join(line.strip() for line in normalized.split("\n")).strip()


def _strip_cjk_characters(text: str) -> str:
    return _CJK_CHAR_PATTERN.sub("", text)


def _to_plain_text_from_markdown(markdown_text: str) -> str:
    text = markdown_text.replace("\r\n", "\n")
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", text)
    text = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)

    # Preserve formula content but remove wrapper delimiters.
    text = re.sub(r"\$\$([\s\S]*?)\$\$", r"\1", text)
    text = re.sub(r"(?<!\\)\$(?!\$)([^\n$]+?)(?<!\\)\$(?!\$)", r"\1", text)
    text = re.sub(r"\\\((.*?)\\\)", r"\1", text)
    text = re.sub(r"\\\[(.*?)\\\]", r"\1", text)

    return _normalize_whitespace(text)


def _to_tesseract_language(language: str | None) -> str:
    if language is None:
        return "eng"
    normalized = language.strip().lower()
    if not normalized:
        return "eng"
    return _LANGUAGE_TO_TESSERACT.get(normalized, "eng")


def _extract_with_tesseract(
    image_bytes: bytes,
    language: str | None,
) -> TextExtractionResult:
    try:
        import pytesseract
    except ImportError as exc:
        raise RuntimeError(
            "pytesseract is not installed. Install pytesseract + Tesseract OCR "
            "to use text_tool=tesseract."
        ) from exc

    language_code = _to_tesseract_language(language)
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            rgb_image = image.convert("RGB")
            text = pytesseract.image_to_string(rgb_image, lang=language_code)
    except Exception as exc:
        raise RuntimeError(f"Tesseract OCR failed: {exc}") from exc

    normalized = _normalize_whitespace(text)
    if not normalized:
        raise RuntimeError("Tesseract OCR returned empty text.")

    return TextExtractionResult(
        text=normalized,
        strategy=f"tesseract-{language_code}",
    )


async def _extract_with_pix2text(
    image_bytes: bytes,
    filename: str,
    settings: Settings,
    ocr_engine_override: str | None,
    ocr_server_type_override: str | None,
    ocr_language_override: str | None,
) -> TextExtractionResult:
    extraction = await extract_latex_from_image(
        image_bytes=image_bytes,
        filename=filename,
        settings=settings,
        mode_override="page",
        ocr_engine_override=ocr_engine_override,
        ocr_server_type_override=ocr_server_type_override,
        ocr_language_override=ocr_language_override,
    )

    source_text = extraction.markdown or extraction.latex
    normalized = _to_plain_text_from_markdown(source_text)
    if not normalized:
        raise RuntimeError("Pix2Text text OCR returned empty text.")

    return TextExtractionResult(
        text=normalized,
        strategy=f"text-via-{extraction.strategy}",
    )


async def extract_text_from_image(
    image_bytes: bytes,
    filename: str,
    settings: Settings,
    text_tool_override: str | None = None,
    ocr_engine_override: str | None = None,
    ocr_server_type_override: str | None = None,
    ocr_language_override: str | None = None,
    strip_cjk: bool = False,
) -> TextExtractionResult:
    tool = _normalize_tool(text_tool_override)
    normalized_engine_override = (
        ocr_engine_override.strip().lower() if ocr_engine_override else ""
    )
    prefer_pix2text_only = tool == "auto" and normalized_engine_override == "cloud"
    errors: list[str] = []

    if tool in {"auto", "tesseract"} and not prefer_pix2text_only:
        if filename.lower().endswith(".pdf"):
            errors.append("Tesseract OCR does not support PDF input.")
        else:
            try:
                tesseract_result = _extract_with_tesseract(
                    image_bytes=image_bytes,
                    language=ocr_language_override,
                )
                candidate_text = tesseract_result.text
                if strip_cjk:
                    candidate_text = _strip_cjk_characters(candidate_text)
                candidate_text = _normalize_whitespace(candidate_text)
                if candidate_text:
                    return TextExtractionResult(
                        text=candidate_text,
                        strategy=tesseract_result.strategy,
                    )
                errors.append("Tesseract OCR returned empty text after filtering.")
            except RuntimeError as exc:
                errors.append(str(exc))

        if tool == "tesseract":
            raise RuntimeError("; ".join(errors))

    if tool in {"auto", "pix2text"}:
        try:
            pix2text_result = await _extract_with_pix2text(
                image_bytes=image_bytes,
                filename=filename,
                settings=settings,
                ocr_engine_override=ocr_engine_override,
                ocr_server_type_override=ocr_server_type_override,
                ocr_language_override=ocr_language_override,
            )
            candidate_text = pix2text_result.text
            if strip_cjk:
                candidate_text = _strip_cjk_characters(candidate_text)
            candidate_text = _normalize_whitespace(candidate_text)
            if candidate_text:
                strategy = pix2text_result.strategy
                if strip_cjk:
                    strategy = f"{strategy}-strip-cjk"
                return TextExtractionResult(
                    text=candidate_text,
                    strategy=strategy,
                )
            errors.append("Pix2Text OCR returned empty text after filtering.")
        except RuntimeError as exc:
            errors.append(str(exc))

    if errors:
        raise RuntimeError("; ".join(errors))
    raise RuntimeError("No text OCR tool could process the request.")
