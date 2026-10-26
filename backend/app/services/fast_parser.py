import io
import pdfplumber
from app.models.schemas import TableData


def _clean_cell(val: object) -> str:
    if val is None:
        return ""
    text = str(val).replace("\r\n", " ").replace("\n", " ").strip()
    return " ".join(text.split())


def extract_tables_fast(pdf_bytes: bytes, filename: str | None = None) -> TableData:
    """
    Extract vector tables from digital PDFs using pdfplumber.
    Tries standard line-based table detection first, then falls back to text-based strategy.
    """
    raw_rows: list[list[str]] = []
    page_count = 1

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                # Fallback for borderless digital tables
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
    normalized_rows = [
        r + [""] * (max_cols - len(r)) for r in raw_rows
    ]

    # Detect 2-row merged table headers (e.g., "Координаты" spanning X, Y, H columns)
    header_row = normalized_rows[0]
    start_data_idx = 1
    if (
        len(normalized_rows) >= 2
        and any(c == "" for c in normalized_rows[0])
        and any(c == "" for c in normalized_rows[1])
        and any(normalized_rows[0][i] == "" and normalized_rows[1][i] != "" for i in range(max_cols))
    ):
        row0 = normalized_rows[0]
        row1 = normalized_rows[1]
        header_row = [
            row1[i] if row1[i] != "" else row0[i]
            for i in range(max_cols)
        ]
        start_data_idx = 2

    headers = [
        h if h else f"Column {idx + 1}"
        for idx, h in enumerate(header_row)
    ]
    data_rows: list[list[str]] = []
    for row in normalized_rows[start_data_idx:]:
        # Skip repeated header rows across multi-page documents
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
