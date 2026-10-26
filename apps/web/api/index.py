import csv
import io
import os
import sys
from enum import Enum
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

load_dotenv()

# Also allow importing from backend/ if available locally
for candidate in [
    Path(__file__).resolve().parent.parent / "backend",
    Path(__file__).resolve().parent.parent.parent.parent / "backend",
]:
    if candidate.exists() and str(candidate) not in sys.path:
        sys.path.insert(0, str(candidate))


class DelimiterOption(str, Enum):
    SEMICOLON = ";"
    COMMA = ","
    TAB = "\t"


class EncodingOption(str, Enum):
    UTF8_SIG = "utf-8-sig"
    CP1251 = "cp1251"
    UTF8 = "utf-8"


class TableData(BaseModel):
    headers: list[str] = Field(default_factory=list)
    rows: list[list[str]] = Field(default_factory=list)
    page_count: int = Field(default=1, ge=1)
    parser_used: Literal["fast", "ai"] = Field(default="fast")
    source_filename: str | None = Field(default=None)


class GeminiExtractedTable(BaseModel):
    headers: list[str]
    rows: list[list[str]]


class ExportOptions(BaseModel):
    delimiter: DelimiterOption = Field(default=DelimiterOption.SEMICOLON)
    encoding: EncodingOption = Field(default=EncodingOption.UTF8_SIG)
    include_headers: bool = Field(default=True)
    filename: str = Field(default="extracted_table.csv")


class ExportRequest(BaseModel):
    table: TableData
    options: ExportOptions = Field(default_factory=ExportOptions)


def _clean_cell(val: object) -> str:
    if val is None:
        return ""
    text = str(val).replace("\r\n", " ").replace("\n", " ").strip()
    return " ".join(text.split())


def extract_tables_fast(pdf_bytes: bytes, filename: str | None = None) -> TableData:
    import pdfplumber

    raw_rows: list[list[str]] = []
    page_count = 1

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                tables = page.extract_tables(
                    table_settings={
                        "vertical_strategy": "text",
                        "horizontal_strategy": "text",
                        "snap_tolerance": 4,
                    }
                )
            for table in tables:
                for row in table:
                    if not row:
                        continue
                    cleaned = [_clean_cell(cell) for cell in row]
                    if any(cell != "" for cell in cleaned):
                        raw_rows.append(cleaned)

    if not raw_rows:
        return TableData(
            headers=["Column 1"],
            rows=[],
            page_count=page_count,
            parser_used="fast",
            source_filename=filename,
        )

    max_cols = max(len(r) for r in raw_rows)
    normalized_rows = [r + [""] * (max_cols - len(r)) for r in raw_rows]

    header_row = normalized_rows[0]
    start_data_idx = 1
    if (
        len(normalized_rows) >= 2
        and any(c == "" for c in normalized_rows[0])
        and any(c == "" for c in normalized_rows[1])
        and any(
            normalized_rows[0][i] == "" and normalized_rows[1][i] != ""
            for i in range(max_cols)
        )
    ):
        row0 = normalized_rows[0]
        row1 = normalized_rows[1]
        header_row = [row1[i] if row1[i] != "" else row0[i] for i in range(max_cols)]
        start_data_idx = 2

    headers = [h if h else f"Column {idx + 1}" for idx, h in enumerate(header_row)]
    data_rows: list[list[str]] = []
    for row in normalized_rows[start_data_idx:]:
        if row == normalized_rows[0] or row == header_row:
            continue
        data_rows.append(row)

    return TableData(
        headers=headers,
        rows=data_rows,
        page_count=page_count,
        parser_used="fast",
        source_filename=filename,
    )


def generate_csv_bytes(table: TableData, options: ExportOptions) -> bytes:
    string_buffer = io.StringIO(newline="")
    writer = csv.writer(
        string_buffer,
        delimiter=options.delimiter.value,
        quotechar='"',
        quoting=csv.QUOTE_MINIMAL,
        lineterminator="\r\n",
    )
    if options.include_headers and table.headers:
        writer.writerow(table.headers)
    for row in table.rows:
        writer.writerow(row)
    csv_text = string_buffer.getvalue()
    return csv_text.encode(options.encoding.value, errors="replace")


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


@router.post("/parse/fast", response_model=TableData)
async def parse_fast_endpoint(file: UploadFile = File(...)) -> TableData:
    pdf_bytes = await _validate_and_read_pdf(file)
    try:
        return extract_tables_fast(pdf_bytes, filename=file.filename)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Fast PDF extraction failed: {exc}"
        ) from exc


@router.post("/parse/ai", response_model=TableData)
async def parse_ai_endpoint(file: UploadFile = File(...)) -> TableData:
    pdf_bytes = await _validate_and_read_pdf(file)
    try:
        from app.services.ai_parser import extract_tables_ai

        return extract_tables_ai(pdf_bytes, filename=file.filename)
    except Exception:
        return extract_tables_fast(pdf_bytes, filename=file.filename)


@router.post("/export/csv")
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


app = FastAPI(title="PDF2CSV AI — Hybrid SaaS API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-CSV-Encoding", "X-CSV-Delimiter"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(router, prefix="/v1", include_in_schema=False)
app.include_router(router, prefix="", include_in_schema=False)


@app.get("/health")
@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "pdf-to-csv-pro-backend"}
