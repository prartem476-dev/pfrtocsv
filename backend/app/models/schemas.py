from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class DelimiterOption(str, Enum):
    SEMICOLON = ";"
    COMMA = ","
    TAB = "\t"


class EncodingOption(str, Enum):
    UTF8_SIG = "utf-8-sig"
    CP1251 = "cp1251"
    UTF8 = "utf-8"


class TableData(BaseModel):
    """Normalized extracted or edited table structure."""

    headers: list[str] = Field(
        default_factory=list,
        description="Column header names",
    )
    rows: list[list[str]] = Field(
        default_factory=list,
        description="2D list of stringified cell values matching headers length",
    )
    page_count: int = Field(
        default=1,
        ge=1,
        description="Total number of pages in the source PDF",
    )
    parser_used: Literal["fast", "ai"] = Field(
        default="fast",
        description="Parser engine that produced this result",
    )
    source_filename: str | None = Field(
        default=None,
        description="Original uploaded PDF file name",
    )


class GeminiExtractedTable(BaseModel):
    """Strict schema passed to Gemini Structured Outputs for table extraction."""

    headers: list[str] = Field(
        description="Column headers of the extracted table. Generate descriptive names if missing."
    )
    rows: list[list[str]] = Field(
        description="Rows of data. Each row must have the same number of elements as headers."
    )


class ExportOptions(BaseModel):
    """Configuration for CSV export formatting and encoding."""

    delimiter: DelimiterOption = Field(
        default=DelimiterOption.SEMICOLON,
        description="CSV field separator (';' recommended for Excel RU/EU)",
    )
    encoding: EncodingOption = Field(
        default=EncodingOption.UTF8_SIG,
        description="Character encoding ('utf-8-sig' adds BOM for Excel compatibility, or 'cp1251')",
    )
    include_headers: bool = Field(
        default=True,
        description="Whether to write the headers row as the first line in CSV",
    )
    filename: str = Field(
        default="extracted_table.csv",
        description="Desired output CSV filename",
    )


class ExportRequest(BaseModel):
    """Request payload for POST /api/v1/export/csv."""

    table: TableData
    options: ExportOptions = Field(default_factory=ExportOptions)
