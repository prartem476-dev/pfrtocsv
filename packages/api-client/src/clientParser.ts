import type { ExportOptions, TableData } from "./index";

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfJsPage {
  getTextContent(): Promise<{ items: PdfJsTextItem[] }>;
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
}

interface PdfJsLib {
  GlobalWorkerOptions?: { workerSrc?: string };
  getDocument(params: {
    data: Uint8Array;
    disableWorker?: boolean;
  }): { promise: Promise<PdfJsDocument> };
}

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

const PDFJS_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

async function loadPdfJs(): Promise<PdfJsLib | null> {
  if (typeof window === "undefined") return null;
  if (window.pdfjsLib) {
    if (
      window.pdfjsLib.GlobalWorkerOptions &&
      !window.pdfjsLib.GlobalWorkerOptions.workerSrc
    ) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
    }
    return window.pdfjsLib;
  }

  const tryLoadScript = (src: string, workerSrc: string) =>
    new Promise<PdfJsLib | null>((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        if (window.pdfjsLib?.GlobalWorkerOptions) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        resolve(window.pdfjsLib ?? null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });

  const localLib = await tryLoadScript("/pdf.min.js", "/pdf.worker.min.js");
  if (localLib) return localLib;

  return tryLoadScript(PDFJS_CDN_URL, PDFJS_WORKER_CDN_URL);
}

interface PositionedCell {
  text: string;
  x: number;
  endX: number;
  y: number;
}

function cleanText(val: string): string {
  return val.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts structured tabular data from a PDF file directly in the browser using pdf.js.
 */
export async function parsePdfClientSide(
  file: File | Blob,
  filename?: string
): Promise<TableData> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const resolvedName =
    filename || (file instanceof File ? file.name : "document.pdf");

  const pdfjs = await loadPdfJs();
  if (!pdfjs) {
    throw new Error("Не удалось инициализировать локальный PDF-парсер.");
  }

  const doc = await pdfjs.getDocument({ data: bytes, disableWorker: true })
    .promise;
  const pageCount = doc.numPages;
  const allRows: string[][] = [];

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const textContent = await page.getTextContent();
    const rawItems: PositionedCell[] = [];

    for (const item of textContent.items) {
      if (!item || typeof item.str !== "string") continue;
      const str = cleanText(item.str);
      if (!str) continue;
      const x = item.transform[4] ?? 0;
      const y = item.transform[5] ?? 0;
      const w = item.width && item.width > 0 ? item.width : str.length * 4.5;
      rawItems.push({
        text: str,
        x,
        endX: x + w,
        y,
      });
    }

    if (rawItems.length === 0) continue;

    // Group items into horizontal lines by Y coordinate (tolerance 4.5pt)
    rawItems.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: PositionedCell[][] = [];
    for (const item of rawItems) {
      const existingLine = lines.find(
        (line) => Math.abs(line[0].y - item.y) <= 4.5
      );
      if (existingLine) {
        existingLine.push(item);
      } else {
        lines.push([item]);
      }
    }

    // Within each line, sort left-to-right and merge fragments that belong to the same cell (gap < 7pt)
    const mergedLines: PositionedCell[][] = lines.map((line) => {
      line.sort((a, b) => a.x - b.x);
      const cells: PositionedCell[] = [];
      for (const item of line) {
        const prev = cells[cells.length - 1];
        if (prev && item.x - prev.endX < 7) {
          prev.text = `${prev.text} ${item.text}`.trim();
          prev.endX = Math.max(prev.endX, item.endX);
        } else {
          cells.push({ ...item });
        }
      }
      return cells;
    });

    // Identify table lines: lines that have >= 3 columns, or if none, >= 2 columns
    const multiColLines = mergedLines.filter((l) => l.length >= 3);
    const candidateLines =
      multiColLines.length >= 2
        ? mergedLines.filter((l) => l.length >= 2)
        : mergedLines;

    // Find the dominant maximum column count among table lines
    const maxColsOnPage = Math.max(...candidateLines.map((l) => l.length), 1);

    if (maxColsOnPage >= 3 && multiColLines.length >= 2) {
      // Determine column X anchors from lines that have the fullest column count
      const fullLines = multiColLines.filter(
        (l) => l.length === maxColsOnPage
      );
      const referenceLines =
        fullLines.length > 0 ? fullLines : multiColLines;

      const colCenters: number[] = [];
      for (const line of referenceLines) {
        for (const cell of line) {
          const center = (cell.x + cell.endX) / 2;
          const existingIdx = colCenters.findIndex(
            (c) => Math.abs(c - center) < 28
          );
          if (existingIdx === -1) {
            colCenters.push(center);
          } else {
            colCenters[existingIdx] = (colCenters[existingIdx] + center) / 2;
          }
        }
      }
      colCenters.sort((a, b) => a - b);

      // Find first and last index of multi-column table block to skip header/footer paragraphs
      const firstTableIdx = mergedLines.findIndex((l) => l.length >= 3);
      let lastTableIdx = mergedLines.length - 1;
      for (let i = mergedLines.length - 1; i >= 0; i--) {
        if (mergedLines[i].length >= 3) {
          lastTableIdx = i;
          break;
        }
      }

      const tableSlice =
        firstTableIdx !== -1
          ? mergedLines.slice(
              Math.max(0, firstTableIdx - 1),
              lastTableIdx + 1
            )
          : mergedLines;

      for (const line of tableSlice) {
        if (line.length < 2) continue;
        // Skip metadata key-value lines above the table that only have 2 items when table has >= 4 cols
        if (colCenters.length >= 4 && line.length === 2) {
          const textJoined = line.map((c) => c.text).join(" ");
          if (textJoined.includes(":")) continue;
        }

        const row = new Array(colCenters.length).fill("");
        for (const cell of line) {
          const center = (cell.x + cell.endX) / 2;
          let bestCol = 0;
          let bestDist = Infinity;
          for (let c = 0; c < colCenters.length; c++) {
            const dist = Math.abs(colCenters[c] - center);
            if (dist < bestDist) {
              bestDist = dist;
              bestCol = c;
            }
          }
          row[bestCol] = row[bestCol]
            ? `${row[bestCol]} ${cell.text}`
            : cell.text;
        }
        if (row.some((c) => c !== "")) {
          allRows.push(row);
        }
      }
    } else {
      for (const line of candidateLines) {
        const row = line.map((c) => c.text);
        if (row.some((c) => c !== "")) {
          allRows.push(row);
        }
      }
    }
  }

  if (allRows.length === 0) {
    return {
      headers: ["Column 1"],
      rows: [],
      page_count: pageCount,
      parser_used: "fast",
      source_filename: resolvedName,
    };
  }

  const maxCols = Math.max(...allRows.map((r) => r.length));
  const normalizedRows = allRows.map((r) =>
    r.concat(new Array(Math.max(0, maxCols - r.length)).fill(""))
  );

  // Merge 2-row headers (e.g., "Координаты" spanning "X, м", "Y, м", "H, м")
  let headerRow = normalizedRows[0];
  let startIdx = 1;
  if (
    normalizedRows.length >= 2 &&
    normalizedRows[0].some((c) => c === "") &&
    normalizedRows[1].some((c) => c === "") &&
    normalizedRows[0].some((c, i) => c === "" && normalizedRows[1][i] !== "")
  ) {
    const r0 = normalizedRows[0];
    const r1 = normalizedRows[1];
    headerRow = r0.map((c0, i) => (r1[i] !== "" ? r1[i] : c0));
    startIdx = 2;
  }

  const headers = headerRow.map((h, i) => (h ? h : `Column ${i + 1}`));
  const rows = normalizedRows
    .slice(startIdx)
    .filter(
      (r) =>
        r.some((c) => c !== "") &&
        r.join("|") !== normalizedRows[0].join("|") &&
        r.join("|") !== headerRow.join("|")
    );

  return {
    headers,
    rows,
    page_count: pageCount,
    parser_used: "fast",
    source_filename: resolvedName,
  };
}

// Windows-1251 special punctuation mapping (0x80 - 0xBF)
const CP1251_SPECIAL_MAP: Record<number, number> = {
  0x0402: 0x80,
  0x0403: 0x81,
  0x201a: 0x82,
  0x0453: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x20ac: 0x88,
  0x2030: 0x89,
  0x0409: 0x8a,
  0x2039: 0x8b,
  0x040a: 0x8c,
  0x040c: 0x8d,
  0x040b: 0x8e,
  0x040f: 0x8f,
  0x0452: 0x90,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x2122: 0x99,
  0x0459: 0x9a,
  0x203a: 0x9b,
  0x045a: 0x9c,
  0x045c: 0x9d,
  0x045b: 0x9e,
  0x045f: 0x9f,
  0x00a0: 0xa0,
  0x040e: 0xa1,
  0x045e: 0xa2,
  0x0408: 0xa3,
  0x00a4: 0xa4,
  0x0490: 0xa5,
  0x00a6: 0xa6,
  0x00a7: 0xa7,
  0x0401: 0xa8, // Ё
  0x00a9: 0xa9,
  0x0404: 0xaa,
  0x00ab: 0xab, // «
  0x00ac: 0xac,
  0x00ad: 0xad,
  0x00ae: 0xae,
  0x0407: 0xaf,
  0x00b0: 0xb0,
  0x00b1: 0xb1,
  0x0406: 0xb2,
  0x0456: 0xb3,
  0x0491: 0xb4,
  0x00b5: 0xb5,
  0x00b6: 0xb6,
  0x00b7: 0xb7,
  0x0451: 0xb8, // ё
  0x2116: 0xb9, // №
  0x0454: 0xba,
  0x00bb: 0xbb, // »
  0x0458: 0xbc,
  0x0405: 0xbd,
  0x0455: 0xbe,
  0x0457: 0xbf,
};

function encodeCp1251(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes[i] = code;
    } else if (code >= 0x0410 && code <= 0x044f) {
      // А-Я (0x0410..0x042F -> 0xC0..0xDF), а-я (0x0430..0x044F -> 0xE0..0xFF)
      bytes[i] = code - 0x0410 + 0xc0;
    } else if (CP1251_SPECIAL_MAP[code] !== undefined) {
      bytes[i] = CP1251_SPECIAL_MAP[code];
    } else {
      bytes[i] = 0x3f; // '?'
    }
  }
  return bytes;
}

function escapeCsvCell(val: string, delimiter: string): string {
  const str = val ?? "";
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes("\r") ||
    str.includes("\n")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an Excel-ready CSV Blob directly in the browser (supporting UTF-8 BOM & Windows-1251).
 */
export function generateCsvBlobClientSide(
  table: TableData,
  options: ExportOptions
): Blob {
  const delimiter = options.delimiter ?? ";";
  const lines: string[] = [];

  if (options.include_headers && table.headers.length > 0) {
    lines.push(
      table.headers.map((h) => escapeCsvCell(h, delimiter)).join(delimiter)
    );
  }

  for (const row of table.rows) {
    lines.push(row.map((c) => escapeCsvCell(c, delimiter)).join(delimiter));
  }

  const csvContent = lines.join("\r\n") + "\r\n";

  if (options.encoding === "cp1251") {
    const cp1251Bytes = encodeCp1251(csvContent);
    return new Blob([cp1251Bytes.buffer as ArrayBuffer], {
      type: "text/csv;charset=windows-1251",
    });
  }

  if (options.encoding === "utf-8-sig") {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const utf8Bytes = new TextEncoder().encode(csvContent);
    return new Blob([bom, utf8Bytes], {
      type: "text/csv;charset=utf-8",
    });
  }

  return new Blob([csvContent], {
    type: "text/csv;charset=utf-8",
  });
}
