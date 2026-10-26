import csv
import io
from app.models.schemas import ExportOptions, TableData


def generate_csv_bytes(table: TableData, options: ExportOptions) -> bytes:
    """
    Serialize TableData into encoded CSV bytes supporting:
    - Delimiters: ';', ',', '\\t'
    - Encodings: 'utf-8-sig' (UTF-8 with BOM for Excel), 'cp1251' (Windows-1251 Cyrillic), 'utf-8'
    """
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
    # Encode with errors="replace" when cp1251 encounters unsupported Unicode symbols
    return csv_text.encode(options.encoding.value, errors="replace")
