import io
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pymupdf as fitz
from fastapi.testclient import TestClient
from app.main import app


def create_sample_cyrillic_invoice_pdf(output_path: Path) -> bytes:
    """
    Generate a clean vector PDF invoice with a bordered table in Russian (Cyrillic)
    using PyMuPDF so pdfplumber can detect lines and extract Cyrillic text.
    """
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)  # A4

    # Use built-in font with Cyrillic support via insert_htmlbox (uses MuPDF universal font)
    html = """
    <div style="font-family: sans-serif; color: #111;">
        <h2 style="margin-bottom: 4px;">СЧЕТ НА ОПЛАТУ № 142 от 26.10.2026</h2>
        <p style="font-size: 10pt; margin-top: 0;">Поставщик: ООО «ТехноСофт Аналитика», ИНН 7701234567</p>
    </div>
    """
    page.insert_htmlbox(fitz.Rect(40, 35, 555, 100), html)

    # Table grid geometry
    table_top = 110
    row_height = 28
    col_x = [40, 80, 310, 380, 465, 555]

    rows_data = [
        ["№", "Наименование товара / услуги", "Кол-во", "Цена, руб.", "Сумма, руб."],
        ["1", "Подписка PDF2CSV AI Enterprise (12 мес.)", "1 шт.", "45 000,00", "45 000,00"],
        ["2", "Пакет распознавания сканов (10 000 стр.)", "2 уп.", "12 500,00", "25 000,00"],
        ["3", "Настройка интеграции с 1С:Бухгалтерия", "5 ч.", "4 200,00", "21 000,00"],
    ]

    for r_idx, row in enumerate(rows_data):
        y0 = table_top + r_idx * row_height
        y1 = y0 + row_height
        for c_idx, cell_text in enumerate(row):
            x0 = col_x[c_idx]
            x1 = col_x[c_idx + 1]
            rect = fitz.Rect(x0, y0, x1, y1)
            # Draw cell border so pdfplumber detects explicit vector lines
            page.draw_rect(rect, color=(0.2, 0.2, 0.2), width=0.8)
            # Insert cell text with padding
            text_rect = fitz.Rect(x0 + 5, y0 + 6, x1 - 5, y1 - 4)
            weight = "bold" if r_idx == 0 else "normal"
            cell_html = f'<div style="font-family: sans-serif; font-size: 9.5pt; font-weight: {weight};">{cell_text}</div>'
            page.insert_htmlbox(text_rect, cell_html)

    pdf_bytes = doc.tobytes()
    doc.close()
    output_path.write_bytes(pdf_bytes)
    return pdf_bytes


def run_phase1_verification() -> None:
    sample_pdf_path = BACKEND_DIR / "sample_invoice_ru.pdf"
    pdf_bytes = create_sample_cyrillic_invoice_pdf(sample_pdf_path)
    print(f"[OK] Generated test PDF: {sample_pdf_path} ({len(pdf_bytes)} bytes)")

    client = TestClient(app)

    # 1. Health endpoint
    res_health = client.get("/health")
    assert res_health.status_code == 200, res_health.text
    print("[OK] GET /health ->", res_health.json())

    # 2. Fast PDF Parser endpoint
    res_fast = client.post(
        "/api/v1/parse/fast",
        files={"file": ("sample_invoice_ru.pdf", pdf_bytes, "application/pdf")},
    )
    assert res_fast.status_code == 200, res_fast.text
    table_data = res_fast.json()
    print("[OK] POST /api/v1/parse/fast ->")
    print("     Headers:", table_data["headers"])
    for idx, r in enumerate(table_data["rows"], start=1):
        print(f"     Row {idx}:", r)

    assert len(table_data["headers"]) == 5, f"Expected 5 headers, got {table_data['headers']}"
    assert len(table_data["rows"]) == 3, f"Expected 3 rows, got {len(table_data['rows'])}"

    # 3. Export CSV with UTF-8-SIG (BOM) & semicolon delimiter
    res_csv_utf8 = client.post(
        "/api/v1/export/csv",
        json={
            "table": table_data,
            "options": {
                "delimiter": ";",
                "encoding": "utf-8-sig",
                "include_headers": True,
                "filename": "счет_142_utf8.csv",
            },
        },
    )
    assert res_csv_utf8.status_code == 200, res_csv_utf8.text
    raw_utf8_bytes = res_csv_utf8.content
    assert raw_utf8_bytes.startswith(b"\xef\xbb\xbf"), "Missing UTF-8 BOM (EF BB BF)!"
    utf8_out = BACKEND_DIR / "sample_export_utf8_bom.csv"
    utf8_out.write_bytes(raw_utf8_bytes)
    print(f"[OK] POST /api/v1/export/csv (utf-8-sig, ';') -> BOM verified, saved to {utf8_out}")

    # 4. Export CSV with Windows-1251 (cp1251) & semicolon delimiter
    res_csv_cp1251 = client.post(
        "/api/v1/export/csv",
        json={
            "table": table_data,
            "options": {
                "delimiter": ";",
                "encoding": "cp1251",
                "include_headers": True,
                "filename": "счет_142_cp1251.csv",
            },
        },
    )
    assert res_csv_cp1251.status_code == 200, res_csv_cp1251.text
    raw_cp1251_bytes = res_csv_cp1251.content
    decoded_cp1251 = raw_cp1251_bytes.decode("cp1251")
    assert "Наименование товара / услуги;Кол-во" in decoded_cp1251
    cp1251_out = BACKEND_DIR / "sample_export_cp1251.csv"
    cp1251_out.write_bytes(raw_cp1251_bytes)
    print(f"[OK] POST /api/v1/export/csv (cp1251, ';') -> Cyrillic verified, saved to {cp1251_out}")
    print("\n=== ALL PHASE 1 BACKEND TESTS PASSED ===")


if __name__ == "__main__":
    run_phase1_verification()
