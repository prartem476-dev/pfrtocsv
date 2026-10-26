import io
from urllib.parse import quote
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from app.models.schemas import ExportRequest, TableData
from app.services.ai_parser import extract_tables_ai
from app.services.csv_exporter import generate_csv_bytes
from app.services.fast_parser import extract_tables_fast

router = APIRouter()


async def _validate_and_read_pdf(file: UploadFile) -> bytes:
    filename = file.filename or "document.pdf"
    if not filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only PDF files (.pdf) are supported.",
        )
    pdf_bytes = await file.read()
    if not pdf_bytes or not pdf_bytes.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty or not a valid PDF document.",
        )
    return pdf_bytes


@router.post(
    "/parse/fast",
    response_model=TableData,
    summary="Fast Vector PDF Table Extraction (pdfplumber)",
)
async def parse_fast_endpoint(
    file: UploadFile = File(..., description="Digital PDF file containing tables"),
) -> TableData:
    pdf_bytes = await _validate_and_read_pdf(file)
    try:
        return extract_tables_fast(pdf_bytes, filename=file.filename)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Fast PDF extraction failed: {exc}",
        ) from exc


@router.post(
    "/parse/ai",
    response_model=TableData,
    summary="AI Multimodal Table Extraction (Gemini Flash Structured Outputs)",
)
async def parse_ai_endpoint(
    file: UploadFile = File(..., description="Scanned or complex PDF file"),
) -> TableData:
    pdf_bytes = await _validate_and_read_pdf(file)
    try:
        return extract_tables_ai(pdf_bytes, filename=file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI PDF extraction failed: {exc}",
        ) from exc


@router.post(
    "/export/csv",
    summary="Export TableData to downloadable CSV stream (UTF-8 BOM / Windows-1251)",
)
async def export_csv_endpoint(payload: ExportRequest) -> StreamingResponse:
    csv_bytes = generate_csv_bytes(payload.table, payload.options)
    safe_name = payload.options.filename or "extracted_table.csv"
    if not safe_name.lower().endswith(".csv"):
        safe_name += ".csv"

    encoded_filename = quote(safe_name)
    headers = {
        "Content-Disposition": f"attachment; filename=\"table.csv\"; filename*=UTF-8''{encoded_filename}",
        "X-CSV-Encoding": payload.options.encoding.value,
        "X-CSV-Delimiter": repr(payload.options.delimiter.value),
    }

    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type=f"text/csv; charset={payload.options.encoding.value}",
        headers=headers,
    )
