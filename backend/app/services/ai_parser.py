import io
import os
import pypdfium2 as pdfium
from PIL import Image
from google import genai
from google.genai import types
from app.models.schemas import GeminiExtractedTable, TableData


SYSTEM_PROMPT = (
    "You are an expert financial and accounting document parser. "
    "Extract the main tabular data from the provided PDF page images (such as invoices, "
    "receipts, bank statements, or reports). "
    "Preserve exact numbers, dates, currencies, and Cyrillic/Latin text. "
    "Merge multi-line cell descriptions into a single clean string per cell. "
    "Ensure every row in `rows` has the exact same number of columns as `headers`."
)


def _render_pdf_pages_to_images(pdf_bytes: bytes, max_pages: int = 10, dpi: int = 200) -> tuple[list[Image.Image], int]:
    """Render PDF pages to PIL Images using pypdfium2 (lightweight, Vercel-compatible, no Poppler required)."""
    pdf = pdfium.PdfDocument(pdf_bytes)
    total_pages = len(pdf)
    images: list[Image.Image] = []
    scale = dpi / 72.0

    for page_index in range(min(total_pages, max_pages)):
        page = pdf[page_index]
        bitmap = page.render(scale=scale)
        pil_image = bitmap.to_pil()
        images.append(pil_image)

    pdf.close()
    return images, total_pages


def extract_tables_ai(pdf_bytes: bytes, filename: str | None = None) -> TableData:
    """
    Convert PDF pages to high-DPI images and use Google Gemini Flash with
    Structured Outputs (Pydantic JSON Schema) to extract complex/scanned tables.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_google_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY environment variable is not configured. "
            "Set GEMINI_API_KEY in backend/.env to use AI Smart Parser."
        )

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    images, page_count = _render_pdf_pages_to_images(pdf_bytes)

    if not images:
        return TableData(
            headers=["Column 1"],
            rows=[],
            page_count=0,
            parser_used="ai",
            source_filename=filename,
        )

    client = genai.Client(api_key=api_key)
    contents: list[object] = [*images, SYSTEM_PROMPT]

    response = client.models.generate_content(
        model=model_name,
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=GeminiExtractedTable,
            temperature=0.0,
        ),
    )

    parsed: GeminiExtractedTable | None = response.parsed
    if parsed is None:
        parsed = GeminiExtractedTable.model_validate_json(response.text)

    headers = parsed.headers or ["Column 1"]
    col_count = len(headers)
    normalized_rows: list[list[str]] = []
    for r in parsed.rows:
        cleaned = [str(c).strip() if c is not None else "" for c in r[:col_count]]
        if len(cleaned) < col_count:
            cleaned.extend([""] * (col_count - len(cleaned)))
        normalized_rows.append(cleaned)

    return TableData(
        headers=headers,
        rows=normalized_rows,
        page_count=page_count,
        parser_used="ai",
        source_filename=filename,
    )
