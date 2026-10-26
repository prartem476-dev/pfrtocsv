import type { ExportOptions, TableData } from "./index";

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfJsViewport {
  width: number;
  height: number;
}

interface PdfJsPage {
  getTextContent(): Promise<{ items: PdfJsTextItem[] }>;
  getViewport(params: { scale: number }): PdfJsViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfJsViewport;
  }): { promise: Promise<void> };
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
    return extractScannedTableClientSide(doc, pageCount, resolvedName);
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


const PROTO_BOLD: Record<string, number[]> = {"0": [0, 0, 2, 9, 51, 83, 92, 51, 15, 0, 0, 0, 0, 5, 36, 81, 98, 75, 72, 98, 93, 49, 6, 0, 0, 28, 87, 98, 94, 19, 14, 92, 98, 94, 37, 0, 2, 65, 98, 98, 85, 12, 4, 78, 98, 98, 89, 0, 24, 88, 98, 98, 74, 9, 3, 68, 98, 98, 98, 15, 46, 98, 98, 98, 66, 6, 3, 65, 98, 98, 98, 52, 68, 98, 98, 98, 66, 6, 3, 64, 98, 98, 98, 89, 79, 98, 98, 98, 70, 6, 3, 64, 98, 98, 98, 97, 85, 98, 98, 98, 70, 6, 3, 71, 98, 98, 98, 98, 83, 98, 98, 98, 64, 5, 3, 74, 98, 98, 98, 95, 52, 98, 98, 98, 62, 5, 3, 71, 98, 98, 98, 67, 23, 95, 98, 98, 74, 7, 3, 73, 98, 98, 98, 21, 7, 75, 96, 98, 79, 11, 3, 74, 98, 98, 88, 3, 0, 31, 91, 98, 90, 16, 9, 89, 98, 94, 44, 0, 0, 6, 54, 90, 98, 72, 73, 98, 89, 50, 6, 0, 0, 0, 2, 32, 72, 86, 88, 67, 36, 0, 0, 0], "1": [0, 0, 0, 0, 0, 17, 61, 93, 85, 24, 0, 0, 4, 14, 35, 57, 86, 102, 106, 106, 90, 33, 0, 0, 71, 91, 101, 105, 106, 106, 106, 106, 90, 32, 0, 0, 29, 41, 48, 93, 106, 106, 106, 106, 90, 32, 0, 0, 0, 0, 1, 67, 103, 106, 106, 106, 89, 30, 0, 0, 0, 0, 0, 63, 102, 106, 106, 106, 89, 30, 0, 0, 0, 0, 0, 64, 102, 106, 106, 106, 89, 30, 0, 0, 0, 0, 0, 64, 102, 106, 106, 106, 89, 30, 0, 0, 0, 0, 0, 66, 102, 106, 106, 106, 88, 29, 0, 0, 0, 0, 0, 64, 102, 106, 106, 106, 88, 28, 0, 0, 0, 0, 0, 64, 102, 106, 106, 106, 89, 30, 0, 0, 0, 0, 0, 66, 102, 106, 106, 106, 88, 28, 0, 0, 0, 0, 0, 67, 102, 106, 106, 106, 91, 28, 0, 0, 0, 0, 3, 73, 104, 106, 106, 106, 93, 34, 1, 0, 38, 49, 67, 97, 105, 106, 106, 106, 104, 87, 59, 42, 64, 101, 103, 103, 101, 98, 100, 101, 100, 99, 98, 87], "2": [0, 0, 6, 35, 85, 100, 103, 84, 32, 3, 0, 0, 0, 17, 71, 104, 106, 106, 106, 106, 105, 73, 14, 0, 2, 74, 105, 106, 105, 106, 106, 106, 106, 105, 66, 4, 39, 105, 84, 51, 41, 78, 106, 106, 106, 106, 102, 7, 46, 58, 13, 0, 0, 7, 74, 106, 106, 106, 104, 7, 1, 0, 0, 0, 0, 0, 44, 106, 106, 106, 94, 1, 0, 0, 0, 0, 0, 0, 45, 106, 106, 106, 54, 0, 0, 0, 0, 0, 0, 3, 80, 106, 106, 85, 16, 0, 0, 0, 0, 0, 0, 34, 103, 106, 93, 30, 1, 0, 0, 0, 0, 0, 16, 86, 106, 93, 30, 1, 0, 0, 0, 0, 0, 12, 79, 106, 93, 23, 0, 0, 2, 4, 0, 0, 9, 62, 102, 84, 17, 3, 3, 12, 57, 85, 0, 6, 59, 104, 105, 89, 76, 76, 79, 92, 105, 93, 2, 50, 102, 106, 106, 106, 106, 106, 106, 106, 106, 56, 60, 103, 106, 106, 106, 106, 106, 106, 106, 106, 105, 24, 77, 106, 106, 105, 103, 101, 97, 98, 98, 94, 73, 0], "3": [0, 0, 0, 10, 46, 92, 104, 98, 49, 9, 0, 0, 0, 5, 48, 96, 110, 112, 112, 112, 110, 85, 26, 0, 0, 49, 102, 107, 108, 112, 112, 112, 112, 111, 81, 2, 10, 91, 74, 25, 11, 33, 97, 112, 112, 112, 102, 17, 1, 28, 8, 0, 0, 3, 58, 110, 112, 112, 82, 8, 0, 0, 0, 0, 0, 6, 68, 111, 112, 97, 34, 0, 0, 0, 0, 3, 14, 53, 100, 112, 111, 78, 12, 0, 0, 0, 0, 32, 91, 108, 112, 112, 112, 108, 72, 6, 0, 0, 0, 16, 69, 95, 109, 112, 112, 112, 112, 54, 0, 0, 0, 0, 3, 16, 55, 101, 112, 112, 112, 88, 0, 0, 0, 0, 0, 0, 1, 55, 110, 112, 112, 112, 1, 4, 4, 1, 0, 0, 0, 6, 86, 112, 112, 76, 19, 63, 53, 16, 2, 0, 0, 6, 82, 111, 110, 35, 92, 112, 112, 98, 45, 15, 11, 37, 100, 108, 69, 0, 85, 112, 112, 112, 108, 91, 86, 103, 100, 54, 11, 0, 15, 64, 104, 107, 111, 109, 91, 58, 14, 1, 0, 0], "4": [0, 0, 0, 0, 0, 0, 0, 11, 66, 96, 36, 0, 0, 0, 0, 0, 0, 0, 13, 68, 108, 109, 63, 0, 0, 0, 0, 0, 0, 7, 59, 105, 109, 108, 64, 0, 0, 0, 0, 0, 6, 62, 109, 109, 109, 108, 65, 0, 0, 0, 0, 2, 51, 105, 109, 109, 109, 108, 64, 0, 0, 0, 1, 41, 105, 96, 101, 109, 109, 106, 61, 0, 0, 1, 27, 90, 90, 44, 76, 109, 109, 106, 62, 0, 0, 15, 81, 102, 36, 17, 74, 109, 109, 106, 62, 0, 3, 62, 103, 52, 5, 19, 73, 109, 109, 107, 65, 2, 48, 106, 97, 61, 50, 60, 94, 109, 109, 108, 89, 31, 93, 106, 106, 106, 106, 109, 109, 109, 109, 109, 107, 96, 85, 105, 106, 106, 106, 106, 109, 109, 109, 109, 106, 97, 21, 44, 42, 44, 40, 48, 94, 109, 109, 107, 83, 29, 0, 0, 0, 0, 0, 14, 72, 107, 107, 104, 62, 0, 0, 0, 0, 0, 0, 12, 70, 106, 106, 104, 61, 0, 0, 0, 0, 0, 3, 8, 54, 95, 99, 90, 37, 0], "5": [0, 0, 8, 60, 91, 99, 98, 95, 97, 99, 97, 71, 0, 2, 42, 95, 102, 102, 102, 102, 102, 102, 102, 81, 0, 10, 75, 101, 102, 102, 102, 102, 102, 102, 95, 31, 0, 25, 92, 98, 86, 79, 78, 79, 80, 74, 45, 0, 1, 56, 101, 86, 59, 42, 22, 13, 10, 8, 2, 0, 18, 90, 102, 102, 102, 102, 100, 81, 41, 6, 0, 0, 49, 101, 102, 102, 102, 102, 102, 102, 100, 74, 27, 0, 83, 100, 101, 101, 102, 102, 102, 102, 102, 101, 84, 24, 27, 43, 46, 58, 71, 85, 95, 102, 102, 102, 102, 70, 0, 0, 0, 0, 2, 10, 26, 73, 101, 102, 102, 95, 0, 0, 0, 0, 0, 0, 0, 4, 61, 100, 102, 97, 0, 0, 2, 0, 0, 0, 0, 0, 26, 89, 102, 80, 20, 62, 66, 29, 3, 0, 0, 0, 17, 84, 102, 48, 88, 102, 102, 101, 76, 23, 11, 17, 64, 96, 66, 4, 62, 99, 102, 102, 102, 96, 83, 87, 85, 48, 8, 0, 0, 45, 81, 98, 101, 96, 79, 47, 12, 0, 0, 0], "6": [0, 0, 0, 0, 0, 0, 0, 20, 52, 74, 95, 60, 0, 0, 0, 0, 13, 47, 80, 100, 99, 80, 59, 21, 0, 0, 1, 36, 88, 103, 104, 89, 38, 7, 1, 0, 0, 2, 39, 96, 104, 103, 78, 13, 0, 0, 0, 0, 0, 20, 90, 104, 104, 87, 13, 0, 0, 0, 0, 0, 0, 72, 104, 104, 103, 43, 12, 16, 10, 2, 0, 0, 22, 100, 104, 104, 104, 100, 104, 104, 97, 72, 28, 0, 58, 104, 104, 104, 95, 66, 85, 103, 104, 103, 95, 19, 94, 104, 104, 104, 58, 3, 11, 87, 104, 104, 104, 75, 103, 104, 104, 104, 56, 3, 2, 54, 104, 104, 104, 93, 96, 104, 104, 104, 65, 4, 1, 45, 104, 104, 104, 103, 58, 103, 104, 104, 79, 7, 2, 46, 102, 104, 104, 90, 12, 100, 104, 104, 94, 9, 2, 47, 104, 104, 104, 65, 0, 56, 100, 104, 104, 47, 6, 58, 104, 103, 86, 9, 0, 10, 56, 95, 104, 96, 78, 95, 103, 77, 26, 0, 0, 0, 1, 20, 62, 96, 96, 72, 31, 2, 0, 0], "7": [0, 66, 118, 121, 119, 118, 118, 118, 118, 118, 118, 100, 15, 109, 124, 124, 124, 124, 124, 124, 124, 124, 124, 98, 42, 121, 124, 124, 124, 124, 124, 124, 124, 124, 121, 63, 80, 123, 119, 114, 95, 81, 81, 88, 122, 124, 103, 6, 110, 85, 27, 8, 3, 2, 3, 27, 116, 123, 65, 2, 28, 7, 0, 0, 0, 0, 2, 59, 121, 113, 26, 0, 0, 0, 0, 0, 0, 0, 9, 106, 124, 92, 12, 0, 0, 0, 0, 0, 0, 0, 40, 120, 120, 50, 1, 0, 0, 0, 0, 0, 0, 3, 82, 124, 106, 26, 0, 0, 0, 0, 0, 0, 0, 23, 115, 122, 72, 9, 0, 0, 0, 0, 0, 0, 0, 67, 123, 119, 47, 1, 0, 0, 0, 0, 0, 0, 9, 95, 124, 101, 21, 0, 0, 0, 0, 0, 0, 0, 34, 116, 123, 70, 2, 0, 0, 0, 0, 0, 0, 8, 68, 121, 109, 40, 0, 0, 0, 0, 0, 0, 0, 22, 104, 124, 92, 6, 0, 0, 0, 0, 0, 0, 0, 19, 111, 111, 36, 1, 0, 0, 0, 0], "8": [5, 4, 0, 26, 67, 79, 95, 81, 46, 15, 0, 0, 0, 23, 74, 94, 94, 72, 68, 81, 96, 87, 43, 2, 13, 84, 96, 96, 69, 12, 5, 28, 91, 96, 89, 31, 54, 92, 96, 96, 58, 8, 0, 20, 86, 96, 96, 70, 61, 93, 96, 96, 87, 38, 1, 16, 79, 96, 96, 63, 39, 89, 96, 96, 96, 94, 49, 43, 96, 96, 90, 9, 3, 65, 93, 96, 96, 96, 95, 90, 96, 76, 21, 0, 0, 11, 54, 90, 96, 96, 96, 96, 92, 53, 9, 0, 0, 4, 41, 88, 96, 95, 96, 96, 96, 89, 49, 3, 0, 58, 93, 96, 70, 62, 91, 96, 96, 96, 90, 52, 57, 96, 96, 93, 30, 1, 41, 95, 96, 96, 96, 81, 89, 96, 96, 79, 23, 0, 7, 57, 96, 96, 96, 92, 87, 96, 96, 84, 26, 0, 1, 27, 96, 96, 96, 82, 56, 93, 96, 90, 41, 5, 4, 39, 96, 96, 91, 30, 12, 56, 83, 94, 82, 64, 66, 89, 96, 80, 36, 0, 0, 5, 30, 56, 86, 95, 94, 73, 48, 11, 0, 0], "9": [0, 0, 5, 33, 73, 102, 99, 75, 24, 0, 0, 0, 0, 23, 76, 100, 95, 76, 99, 103, 97, 56, 7, 0, 5, 84, 103, 103, 69, 9, 39, 103, 103, 102, 71, 0, 59, 103, 103, 103, 58, 2, 12, 92, 103, 103, 96, 17, 86, 103, 103, 103, 43, 1, 4, 75, 103, 103, 103, 72, 101, 103, 103, 103, 51, 2, 3, 65, 103, 103, 103, 97, 97, 103, 103, 103, 70, 3, 2, 61, 103, 103, 103, 99, 56, 103, 103, 103, 91, 7, 3, 64, 103, 103, 103, 91, 10, 84, 103, 103, 103, 75, 60, 86, 103, 103, 103, 75, 0, 19, 71, 99, 103, 103, 100, 103, 103, 103, 100, 34, 0, 0, 0, 10, 30, 23, 39, 103, 103, 103, 76, 0, 0, 0, 0, 0, 0, 13, 72, 103, 103, 89, 30, 0, 0, 0, 0, 0, 4, 65, 101, 103, 99, 48, 4, 0, 0, 0, 3, 21, 70, 102, 102, 92, 44, 4, 0, 0, 18, 40, 65, 92, 103, 87, 54, 21, 4, 0, 0, 0, 61, 102, 95, 76, 46, 3, 0, 0, 0, 0, 0, 0]};
const PROTO_REGULAR: Record<string, number[]> = {"0": [0, 0, 1, 27, 74, 100, 102, 71, 25, 0, 0, 0, 0, 9, 69, 108, 109, 109, 109, 109, 107, 78, 13, 0, 0, 61, 109, 109, 91, 63, 61, 92, 109, 109, 59, 0, 14, 99, 109, 86, 11, 0, 0, 11, 90, 109, 102, 9, 46, 109, 109, 44, 0, 0, 0, 0, 47, 109, 109, 50, 74, 109, 105, 23, 0, 0, 0, 0, 18, 108, 109, 87, 95, 109, 103, 13, 0, 0, 0, 0, 10, 104, 109, 94, 103, 109, 102, 8, 0, 0, 0, 0, 6, 104, 109, 102, 102, 109, 101, 8, 0, 0, 0, 0, 6, 105, 109, 102, 91, 109, 101, 11, 0, 0, 0, 0, 10, 105, 109, 93, 78, 109, 105, 20, 0, 0, 0, 0, 18, 108, 109, 81, 47, 109, 109, 39, 0, 0, 0, 0, 48, 109, 109, 46, 10, 96, 109, 90, 11, 0, 0, 11, 91, 109, 104, 10, 0, 63, 109, 109, 95, 66, 68, 95, 109, 108, 61, 0, 0, 13, 78, 106, 109, 109, 109, 109, 107, 65, 8, 0, 0, 0, 1, 27, 74, 104, 103, 74, 21, 0, 0, 0], "1": [0, 0, 0, 0, 0, 0, 0, 5, 45, 90, 103, 70, 0, 0, 0, 0, 0, 7, 40, 84, 106, 112, 111, 102, 0, 0, 2, 12, 39, 84, 109, 112, 112, 112, 110, 97, 6, 39, 77, 101, 110, 112, 112, 112, 112, 112, 110, 96, 89, 108, 112, 112, 110, 101, 83, 100, 111, 112, 110, 94, 100, 109, 106, 79, 36, 3, 8, 76, 108, 112, 110, 94, 9, 12, 5, 1, 0, 0, 8, 78, 109, 112, 110, 94, 0, 0, 0, 0, 0, 0, 8, 78, 109, 112, 109, 94, 0, 0, 0, 0, 0, 0, 9, 79, 110, 112, 109, 93, 0, 0, 0, 0, 0, 0, 9, 80, 110, 112, 109, 94, 0, 0, 0, 0, 0, 0, 9, 80, 110, 112, 109, 94, 0, 0, 0, 0, 0, 0, 9, 80, 110, 112, 109, 94, 0, 0, 0, 0, 0, 0, 9, 80, 110, 112, 109, 93, 0, 0, 0, 0, 0, 1, 11, 81, 110, 112, 110, 95, 0, 0, 0, 0, 0, 0, 11, 81, 110, 112, 110, 97, 0, 0, 0, 0, 0, 0, 4, 57, 96, 108, 99, 59], "2": [0, 0, 1, 36, 85, 107, 106, 83, 40, 2, 0, 0, 0, 22, 86, 111, 112, 112, 113, 112, 110, 92, 30, 0, 2, 86, 112, 112, 95, 65, 62, 91, 112, 112, 94, 7, 29, 112, 113, 77, 6, 1, 1, 6, 71, 113, 112, 42, 44, 103, 104, 24, 0, 0, 0, 0, 34, 111, 113, 54, 0, 3, 7, 0, 0, 0, 0, 0, 52, 113, 113, 45, 0, 0, 0, 0, 0, 0, 0, 14, 97, 113, 105, 14, 0, 0, 0, 0, 0, 0, 14, 97, 113, 112, 56, 0, 0, 0, 0, 0, 0, 24, 101, 113, 112, 83, 7, 0, 0, 0, 0, 2, 39, 108, 113, 111, 71, 4, 0, 0, 0, 0, 2, 67, 112, 113, 110, 52, 2, 0, 0, 0, 0, 12, 78, 113, 113, 94, 28, 0, 0, 0, 0, 0, 2, 72, 113, 112, 82, 10, 2, 2, 2, 2, 3, 0, 29, 112, 113, 110, 86, 81, 81, 82, 83, 82, 84, 58, 94, 113, 113, 113, 113, 113, 113, 113, 113, 113, 113, 104, 71, 105, 105, 104, 103, 100, 100, 101, 102, 102, 102, 61], "3": [0, 0, 0, 47, 95, 111, 103, 71, 15, 0, 0, 0, 0, 22, 92, 116, 116, 116, 116, 116, 110, 61, 6, 0, 3, 93, 116, 115, 90, 62, 73, 104, 116, 114, 46, 0, 37, 116, 116, 79, 4, 0, 0, 31, 112, 116, 83, 0, 30, 85, 89, 20, 0, 0, 0, 15, 107, 116, 91, 1, 0, 0, 0, 0, 0, 0, 2, 56, 115, 116, 65, 0, 0, 0, 0, 0, 31, 85, 104, 116, 116, 87, 14, 0, 0, 0, 0, 1, 73, 116, 116, 116, 116, 72, 15, 0, 0, 0, 0, 0, 27, 51, 49, 82, 115, 116, 97, 11, 0, 0, 0, 0, 0, 0, 0, 1, 52, 116, 116, 70, 0, 2, 1, 0, 0, 0, 0, 0, 13, 108, 116, 111, 85, 109, 99, 14, 0, 0, 0, 0, 18, 112, 116, 105, 78, 116, 116, 67, 3, 0, 0, 5, 78, 116, 116, 61, 16, 105, 116, 114, 91, 72, 74, 98, 115, 116, 95, 8, 0, 36, 96, 116, 116, 116, 116, 116, 114, 84, 21, 0, 0, 0, 3, 38, 91, 114, 111, 77, 17, 1, 0, 0], "4": [0, 0, 0, 0, 0, 0, 0, 33, 104, 69, 4, 0, 0, 0, 0, 0, 0, 0, 26, 109, 117, 93, 10, 0, 0, 0, 0, 0, 0, 13, 102, 117, 117, 93, 9, 0, 0, 0, 0, 0, 6, 82, 117, 117, 117, 92, 8, 0, 0, 0, 0, 2, 61, 116, 117, 117, 117, 92, 7, 0, 0, 0, 0, 49, 115, 117, 100, 95, 117, 91, 6, 0, 0, 0, 21, 106, 117, 103, 26, 86, 117, 90, 7, 0, 0, 13, 99, 117, 111, 33, 5, 87, 117, 89, 7, 0, 2, 77, 117, 115, 50, 1, 5, 86, 117, 88, 6, 0, 55, 114, 117, 97, 43, 42, 44, 99, 117, 102, 42, 14, 104, 116, 117, 117, 117, 117, 117, 117, 117, 117, 117, 108, 93, 115, 116, 116, 116, 116, 116, 117, 117, 117, 116, 100, 10, 19, 19, 17, 18, 16, 23, 97, 117, 95, 21, 9, 0, 0, 0, 0, 0, 0, 6, 90, 117, 89, 6, 0, 0, 0, 0, 0, 0, 0, 6, 90, 117, 92, 7, 0, 0, 0, 0, 0, 0, 0, 2, 65, 113, 64, 3, 0], "5": [0, 6, 68, 101, 100, 97, 95, 95, 96, 99, 65, 1, 0, 28, 103, 109, 109, 109, 109, 109, 109, 109, 93, 3, 0, 43, 107, 108, 95, 78, 78, 78, 78, 78, 52, 0, 0, 64, 108, 106, 34, 1, 1, 1, 0, 1, 0, 0, 0, 81, 108, 100, 15, 2, 3, 2, 0, 0, 0, 0, 7, 99, 109, 101, 70, 101, 106, 100, 69, 12, 0, 0, 26, 107, 109, 109, 109, 109, 109, 109, 109, 100, 39, 0, 62, 108, 109, 103, 65, 37, 39, 69, 105, 109, 97, 13, 27, 68, 70, 22, 1, 0, 0, 2, 55, 109, 108, 69, 0, 0, 0, 0, 0, 0, 0, 0, 13, 105, 109, 99, 0, 2, 1, 0, 0, 0, 0, 0, 8, 103, 109, 104, 82, 100, 91, 8, 0, 0, 0, 0, 21, 106, 109, 85, 81, 108, 109, 57, 3, 0, 0, 6, 78, 109, 107, 34, 14, 100, 108, 106, 83, 61, 63, 91, 108, 108, 70, 1, 0, 37, 97, 109, 109, 109, 109, 109, 106, 67, 9, 0, 0, 0, 6, 57, 94, 106, 100, 73, 21, 0, 0, 0], "6": [0, 0, 0, 8, 46, 90, 104, 92, 54, 6, 0, 0, 0, 1, 35, 96, 107, 107, 107, 107, 107, 94, 33, 0, 0, 36, 105, 107, 96, 69, 56, 79, 104, 107, 89, 5, 2, 84, 107, 95, 13, 0, 0, 1, 59, 107, 107, 43, 26, 104, 107, 53, 0, 0, 0, 0, 13, 82, 81, 29, 52, 107, 105, 22, 19, 54, 71, 63, 24, 0, 0, 0, 81, 107, 104, 81, 105, 107, 107, 107, 106, 87, 18, 0, 96, 107, 107, 107, 95, 71, 69, 91, 106, 107, 86, 3, 98, 107, 107, 67, 6, 1, 1, 5, 62, 107, 107, 51, 93, 107, 103, 14, 0, 0, 0, 0, 14, 103, 107, 93, 72, 107, 97, 6, 0, 0, 0, 0, 6, 96, 107, 103, 40, 107, 105, 27, 0, 0, 0, 0, 18, 103, 107, 79, 8, 95, 107, 77, 6, 0, 0, 2, 59, 107, 107, 33, 0, 52, 106, 106, 92, 69, 63, 85, 105, 107, 77, 3, 0, 5, 57, 99, 107, 107, 107, 107, 105, 82, 18, 0, 0, 0, 0, 11, 58, 98, 99, 75, 26, 1, 0, 0], "7": [71, 118, 118, 117, 116, 117, 117, 118, 119, 118, 119, 85, 124, 132, 132, 132, 132, 132, 132, 132, 132, 132, 132, 125, 61, 94, 93, 92, 90, 92, 92, 90, 114, 132, 129, 57, 0, 2, 2, 2, 2, 2, 2, 19, 114, 132, 75, 0, 0, 0, 0, 0, 0, 0, 10, 107, 132, 108, 13, 0, 0, 0, 0, 0, 0, 2, 85, 132, 128, 18, 0, 0, 0, 0, 0, 0, 0, 43, 130, 132, 68, 0, 0, 0, 0, 0, 0, 0, 6, 113, 132, 119, 15, 1, 0, 0, 0, 0, 0, 0, 54, 132, 132, 60, 0, 0, 0, 0, 0, 0, 0, 6, 109, 132, 122, 8, 0, 0, 0, 0, 0, 0, 0, 30, 128, 132, 84, 0, 0, 0, 0, 0, 0, 0, 0, 71, 132, 130, 33, 0, 0, 0, 0, 0, 0, 0, 0, 106, 132, 118, 12, 0, 0, 0, 0, 0, 0, 0, 6, 126, 132, 101, 4, 0, 0, 0, 0, 0, 0, 0, 27, 131, 132, 84, 1, 0, 0, 0, 0, 0, 0, 0, 18, 116, 125, 40, 0, 0, 0, 0, 0, 0], "8": [0, 0, 1, 32, 78, 97, 100, 81, 38, 2, 0, 0, 0, 19, 79, 103, 104, 104, 104, 104, 103, 81, 21, 0, 3, 76, 104, 102, 83, 62, 59, 80, 102, 104, 77, 5, 21, 100, 104, 79, 5, 0, 0, 4, 77, 104, 102, 29, 25, 102, 104, 60, 1, 0, 0, 1, 60, 104, 103, 32, 8, 92, 104, 96, 23, 1, 1, 20, 93, 104, 94, 10, 0, 40, 98, 104, 102, 95, 95, 102, 104, 97, 38, 0, 0, 15, 80, 104, 104, 104, 104, 104, 104, 81, 16, 0, 8, 86, 103, 102, 76, 45, 44, 72, 102, 103, 87, 8, 58, 103, 103, 51, 1, 0, 0, 1, 51, 103, 103, 63, 94, 104, 98, 11, 0, 0, 0, 0, 10, 99, 104, 96, 92, 103, 99, 13, 0, 0, 0, 0, 11, 100, 104, 94, 57, 103, 103, 54, 2, 0, 0, 1, 51, 103, 104, 59, 9, 85, 104, 101, 82, 59, 59, 79, 101, 104, 88, 8, 0, 29, 84, 103, 104, 104, 104, 104, 103, 82, 26, 0, 0, 0, 3, 32, 72, 97, 95, 71, 33, 1, 0, 0], "9": [0, 0, 1, 29, 80, 103, 98, 58, 11, 0, 0, 0, 0, 20, 80, 104, 105, 105, 105, 105, 98, 62, 9, 0, 5, 84, 105, 104, 88, 65, 62, 84, 104, 104, 61, 0, 47, 105, 105, 75, 6, 0, 0, 3, 65, 105, 99, 16, 87, 105, 102, 18, 0, 0, 0, 0, 14, 102, 105, 58, 103, 105, 98, 5, 0, 0, 0, 0, 6, 99, 105, 80, 91, 105, 103, 15, 0, 0, 0, 0, 17, 101, 105, 96, 55, 105, 105, 73, 8, 1, 1, 8, 75, 105, 105, 101, 6, 89, 105, 104, 90, 71, 70, 91, 105, 105, 105, 96, 0, 21, 89, 104, 105, 105, 105, 103, 75, 105, 105, 88, 0, 0, 2, 30, 66, 72, 50, 14, 18, 102, 105, 65, 31, 78, 80, 18, 0, 0, 0, 1, 55, 105, 104, 35, 50, 105, 105, 72, 3, 0, 0, 16, 97, 105, 90, 5, 9, 89, 105, 103, 76, 56, 69, 95, 105, 102, 43, 0, 0, 32, 91, 105, 105, 105, 105, 105, 97, 47, 3, 0, 0, 0, 7, 57, 95, 102, 90, 53, 7, 0, 0, 0]};

function percentile15(arr: Uint8Array): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < arr.length; i++) {
    hist[arr[i]]++;
  }
  const target = Math.floor(arr.length * 0.15);
  let count = 0;
  for (let v = 0; v < 256; v++) {
    count += hist[v];
    if (count >= target) return v;
  }
  return 140;
}

function medianInt(vals: number[]): number {
  if (vals.length === 0) return 0;
  const sorted = [...vals].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function resizePatch12x16(
  bw: Float32Array,
  stride: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number
): Float32Array {
  const sh = ey - sy;
  const sw = ex - sx;
  const th = 16;
  const tw = 12;
  const vec = new Float32Array(th * tw);
  let normSq = 0;

  for (let ty = 0; ty < th; ty++) {
    const fy = th > 1 ? (ty * Math.max(0, sh - 1)) / (th - 1) : 0;
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, Math.max(0, sh - 1));
    const wy = fy - y0;
    const row0 = (sy + y0) * stride;
    const row1 = (sy + y1) * stride;

    for (let tx = 0; tx < tw; tx++) {
      const fx = tw > 1 ? (tx * Math.max(0, sw - 1)) / (tw - 1) : 0;
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, Math.max(0, sw - 1));
      const wx = fx - x0;

      const top = bw[row0 + sx + x0] * (1 - wx) + bw[row0 + sx + x1] * wx;
      const bot = bw[row1 + sx + x0] * (1 - wx) + bw[row1 + sx + x1] * wx;
      const val = top * (1 - wy) + bot * wy;
      vec[ty * tw + tx] = val;
      normSq += val * val;
    }
  }

  const norm = Math.sqrt(normSq);
  if (norm > 1e-6) {
    for (let i = 0; i < vec.length; i++) {
      vec[i] /= norm;
    }
  }
  return vec;
}

function segmentCellChars(
  cellGray: Uint8Array,
  w: number,
  h: number
): Array<[number, number, number, number]> {
  if (h < 6 || w < 6) return [];
  const thresh = Math.min(190, percentile15(cellGray) + 50);
  const bw = new Uint8Array(w * h);
  const rowInk = new Int32Array(h);

  for (let y = 0; y < h; y++) {
    let sum = 0;
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const v = cellGray[rowOff + x] < thresh ? 1 : 0;
      bw[rowOff + x] = v;
      sum += v;
    }
    rowInk[y] = sum;
  }

  const activeY: number[] = [];
  for (let y = 0; y < h; y++) {
    if (rowInk[y] >= 2) activeY.push(y);
  }
  if (activeY.length === 0) return [];

  const yCenter = medianInt(activeY);
  const y0 = Math.max(0, yCenter - 14);
  const y1 = Math.min(h, yCenter + 14);

  const colSum = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let cSum = 0;
    for (let y = y0; y < y1; y++) {
      cSum += bw[y * w + x];
    }
    colSum[x] = cSum;
  }

  const runs: Array<[number, number]> = [];
  let inRun = false;
  let sx = 0;
  for (let x = 0; x < w; x++) {
    if (colSum[x] > 0 && !inRun) {
      inRun = true;
      sx = x;
    } else if (colSum[x] === 0 && inRun) {
      inRun = false;
      runs.push([sx, x]);
    }
  }
  if (inRun) runs.push([sx, w]);

  const cleanBoxes: Array<[number, number, number, number]> = [];
  for (const [rSx, rEx] of runs) {
    let firstY = -1;
    let lastY = -1;
    for (let y = y0; y < y1; y++) {
      let hasInk = false;
      for (let x = rSx; x < rEx; x++) {
        if (bw[y * w + x]) {
          hasInk = true;
          break;
        }
      }
      if (hasInk) {
        if (firstY === -1) firstY = y;
        lastY = y;
      }
    }
    if (firstY === -1) continue;
    const cy0 = firstY;
    const cy1 = lastY + 1;
    let ink = 0;
    for (let y = cy0; y < cy1; y++) {
      for (let x = rSx; x < rEx; x++) {
        ink += bw[y * w + x];
      }
    }
    const cw = rEx - rSx;
    const ch = cy1 - cy0;
    if (ink < 5 || (ch <= 3 && cw <= 2 && ink < 6)) continue;

    if (cw >= 21) {
      const midL = rSx + Math.max(6, Math.floor(cw / 3));
      const midR = rSx + Math.min(cw - 6, Math.floor((2 * cw) / 3) + 2);
      let splitX = midL;
      let minVal = Infinity;
      for (let x = midL; x < midR; x++) {
        if (colSum[x] < minVal) {
          minVal = colSum[x];
          splitX = x;
        }
      }
      for (const [pSx, pEx] of [
        [rSx, splitX],
        [splitX, rEx],
      ] as Array<[number, number]>) {
        let pfY = -1;
        let plY = -1;
        for (let y = y0; y < y1; y++) {
          for (let x = pSx; x < pEx; x++) {
            if (bw[y * w + x]) {
              if (pfY === -1) pfY = y;
              plY = y;
              break;
            }
          }
        }
        if (pfY !== -1) {
          cleanBoxes.push([pSx, pfY, pEx, plY + 1]);
        }
      }
    } else {
      cleanBoxes.push([rSx, cy0, rEx, cy1]);
    }
  }

  if (cleanBoxes.length > 1) {
    const tallBoxes = cleanBoxes.filter((b) => b[3] - b[1] >= 12);
    if (tallBoxes.length > 0) {
      const minTx = Math.min(...tallBoxes.map((b) => b[0]));
      const maxTx = Math.max(...tallBoxes.map((b) => b[2]));
      return cleanBoxes.filter(
        (b) =>
          b[3] - b[1] >= 12 ||
          (b[0] >= minTx - 4 && b[2] <= maxTx + 4 && b[1] > yCenter)
      );
    }
  }
  return cleanBoxes;
}

function recognizeCellClient(
  cellGray: Uint8Array,
  w: number,
  h: number,
  isBoldCol: boolean
): string {
  const boxes = segmentCellChars(cellGray, w, h);
  if (boxes.length === 0) return "";
  const thresh = Math.min(190, percentile15(cellGray) + 50);
  const bw = new Float32Array(w * h);
  for (let i = 0; i < cellGray.length; i++) {
    bw[i] = cellGray[i] < thresh ? 1.0 : 0.0;
  }

  const chars: string[] = [];
  for (const [sx, sy, ex, ey] of boxes) {
    const ch = ey - sy;
    const cw = ex - sx;
    if (ch <= 9 && cw <= 9) {
      chars.push(".");
      continue;
    }
    const vec = resizePatch12x16(bw, w, sx, sy, ex, ey);
    let bestLabel = "0";
    let bestSim = -1.0;

    const styles: Array<[boolean, Record<string, number[]>]> = [
      [true, PROTO_BOLD],
      [false, PROTO_REGULAR],
    ];
    for (const [styleBold, protoMap] of styles) {
      const bonus = styleBold === isBoldCol ? 0.03 : 0.0;
      for (const [label, qVec] of Object.entries(protoMap)) {
        let dot = 0;
        for (let i = 0; i < vec.length; i++) {
          dot += vec[i] * (qVec[i] / 1000.0);
        }
        const sim = dot + bonus;
        if (sim > bestSim) {
          bestSim = sim;
          bestLabel = label;
        }
      }
    }
    chars.push(bestLabel);
  }
  return chars.join("");
}

async function extractScannedTableClientSide(
  doc: PdfJsDocument,
  pageCount: number,
  resolvedName: string
): Promise<TableData> {
  if (typeof document === "undefined") {
    return {
      headers: ["Column 1"],
      rows: [],
      page_count: pageCount,
      parser_used: "fast",
      source_filename: resolvedName,
    };
  }

  const allRows: string[][] = [];
  let detectedCols = 0;
  let hasKgsHeader = false;

  for (let p = 1; p <= pageCount; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 200.0 / 72.0 });
    const w = Math.round(viewport.width);
    const h = Math.round(viewport.height);

    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = w;
    baseCanvas.height = h;
    const baseCtx = baseCanvas.getContext("2d");
    if (!baseCtx) continue;
    baseCtx.fillStyle = "#ffffff";
    baseCtx.fillRect(0, 0, w, h);
    await page.render({ canvasContext: baseCtx, viewport }).promise;

    // Fast deskew search on 1/2 size canvas
    const sw = Math.max(1, Math.floor(w / 2));
    const sh = Math.max(1, Math.floor(h / 2));
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = sw;
    smallCanvas.height = sh;
    const smallCtx = smallCanvas.getContext("2d");

    let bestAngle = 0;
    let bestScore = -1;
    if (smallCtx) {
      for (let step = -15; step <= 15; step++) {
        const angleDeg = step * 0.1;
        const rad = (-angleDeg * Math.PI) / 180.0;
        smallCtx.fillStyle = "#ffffff";
        smallCtx.fillRect(0, 0, sw, sh);
        smallCtx.save();
        smallCtx.translate(sw / 2, sh / 2);
        smallCtx.rotate(rad);
        smallCtx.drawImage(baseCanvas, -sw / 2, -sh / 2, sw, sh);
        smallCtx.restore();

        const imgData = smallCtx.getImageData(0, 0, sw, sh).data;
        const yStart = Math.floor(sh * 0.05);
        const yEnd = Math.floor(sh * 0.95);
        const xStart = Math.floor(sw * 0.08);
        const xEnd = Math.floor(sw * 0.92);
        const spanW = Math.max(1, xEnd - xStart);
        let score = 0;
        for (let y = yStart; y < yEnd; y++) {
          let darkCnt = 0;
          const rowBase = y * sw;
          for (let x = xStart; x < xEnd; x++) {
            const idx = (rowBase + x) * 4;
            const g = (77 * imgData[idx] + 150 * imgData[idx + 1] + 29 * imgData[idx + 2]) >> 8;
            if (g < 175) darkCnt++;
          }
          const m = darkCnt / spanW;
          score += m * m * m * m;
        }
        if (score > bestScore) {
          bestScore = score;
          bestAngle = angleDeg;
        }
      }
    }

    let workCanvas = baseCanvas;
    if (Math.abs(bestAngle) > 0.01) {
      const rotCanvas = document.createElement("canvas");
      rotCanvas.width = w;
      rotCanvas.height = h;
      const rotCtx = rotCanvas.getContext("2d");
      if (rotCtx) {
        rotCtx.fillStyle = "#ffffff";
        rotCtx.fillRect(0, 0, w, h);
        rotCtx.save();
        rotCtx.translate(w / 2, h / 2);
        rotCtx.rotate((-bestAngle * Math.PI) / 180.0);
        rotCtx.drawImage(baseCanvas, -w / 2, -h / 2, w, h);
        rotCtx.restore();
        workCanvas = rotCanvas;
      }
    }

    const workCtx = workCanvas.getContext("2d");
    if (!workCtx) continue;
    const rgba = workCtx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    const dark = new Uint8Array(w * h);
    const marginY = Math.floor(h * 0.03);
    const marginX = Math.floor(w * 0.03);

    for (let y = 0; y < h; y++) {
      const rowOff = y * w;
      const inY = y >= marginY && y < h - marginY;
      for (let x = 0; x < w; x++) {
        const idx = (rowOff + x) * 4;
        const g = (77 * rgba[idx] + 150 * rgba[idx + 1] + 29 * rgba[idx + 2]) >> 8;
        gray[rowOff + x] = g;
        if (inY && x >= marginX && x < w - marginX && g < 180) {
          dark[rowOff + x] = 1;
        }
      }
    }

    // Horizontal lines via 3px vertical band projection
    const xL = Math.floor(w * 0.1);
    const xR = Math.floor(w * 0.9);
    const spanX = Math.max(1, xR - xL);
    const hCandidates: number[] = [];
    for (let y = 1; y < h - 1; y++) {
      let cnt = 0;
      const r0 = (y - 1) * w;
      const r1 = y * w;
      const r2 = (y + 1) * w;
      for (let x = xL; x < xR; x++) {
        if (dark[r0 + x] | dark[r1 + x] | dark[r2 + x]) cnt++;
      }
      if (cnt / spanX > 0.5) hCandidates.push(y);
    }

    const rawHLines: number[] = [];
    if (hCandidates.length > 0) {
      let cluster = [hCandidates[0]];
      for (let i = 1; i < hCandidates.length; i++) {
        const y = hCandidates[i];
        if (y - cluster[cluster.length - 1] <= 10) {
          cluster.push(y);
        } else {
          rawHLines.push(
            Math.floor(cluster.reduce((a, b) => a + b, 0) / cluster.length)
          );
          cluster = [y];
        }
      }
      rawHLines.push(
        Math.floor(cluster.reduce((a, b) => a + b, 0) / cluster.length)
      );
    }

    let hLines: number[] = [];
    if (rawHLines.length > 0) {
      let currGroup = [rawHLines[0]];
      for (let i = 1; i < rawHLines.length; i++) {
        const y = rawHLines[i];
        const diff = y - currGroup[currGroup.length - 1];
        if (diff >= 18 && diff <= 140) {
          currGroup.push(y);
        } else {
          if (currGroup.length > hLines.length) hLines = currGroup;
          currGroup = [y];
        }
      }
      if (currGroup.length > hLines.length) hLines = currGroup;
    }

    if (hLines.length < 2) continue;

    // True vertical lines
    const yTop = hLines[0];
    const yBot = hLines[hLines.length - 1];
    const spanY = Math.max(1, yBot - yTop + 1);
    const vCandidates: number[] = [];
    for (let x = 1; x < w - 1; x++) {
      let cnt = 0;
      for (let y = yTop; y <= yBot; y++) {
        const r = y * w;
        if (dark[r + x - 1] | dark[r + x] | dark[r + x + 1]) cnt++;
      }
      if (cnt / spanY > 0.78) vCandidates.push(x);
    }

    const vLines: number[] = [];
    if (vCandidates.length > 0) {
      let cluster = [vCandidates[0]];
      for (let i = 1; i < vCandidates.length; i++) {
        const x = vCandidates[i];
        if (x - cluster[cluster.length - 1] <= 18) {
          cluster.push(x);
        } else {
          vLines.push(
            Math.floor(cluster.reduce((a, b) => a + b, 0) / cluster.length)
          );
          cluster = [x];
        }
      }
      vLines.push(
        Math.floor(cluster.reduce((a, b) => a + b, 0) / cluster.length)
      );
    }

    if (vLines.length < 2) continue;
    const numCols = vLines.length - 1;
    detectedCols = Math.max(detectedCols, numCols);

    let startRow = 0;
    if (hLines.length >= 3 && numCols >= 3) {
      const y1 = hLines[1];
      let darkCnt = 0;
      let totCnt = 0;
      const rx0 = vLines[0] + 10;
      const rx1 = vLines[Math.min(2, numCols)] - 10;
      for (let y = Math.max(0, y1 - 3); y < Math.min(h, y1 + 4); y++) {
        for (let x = rx0; x < rx1; x++) {
          totCnt++;
          if (gray[y * w + x] < 180) darkCnt++;
        }
      }
      if (totCnt > 0 && darkCnt / totCnt < 0.08) {
        startRow = 2;
        hasKgsHeader = true;
      }
    }

    for (let r = startRow; r < hLines.length - 1; r++) {
      const yt = hLines[r] + 4;
      const yb = hLines[r + 1] - 4;
      if (yb <= yt + 6) continue;
      const ch = yb - yt;
      const rowVals: string[] = [];

      for (let c = 0; c < numCols; c++) {
        const xl = vLines[c] + 8;
        const xr = vLines[c + 1] - 8;
        if (xr <= xl + 6) {
          rowVals.push("");
          continue;
        }
        const cw = xr - xl;
        const cellGray = new Uint8Array(cw * ch);
        for (let cy = 0; cy < ch; cy++) {
          const srcOff = (yt + cy) * w + xl;
          const dstOff = cy * cw;
          for (let cx = 0; cx < cw; cx++) {
            cellGray[dstOff + cx] = gray[srcOff + cx];
          }
        }
        rowVals.push(recognizeCellClient(cellGray, cw, ch, c < 2));
      }
      if (rowVals.some((v) => v !== "")) {
        allRows.push(rowVals);
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

  const headers =
    detectedCols === 5 && hasKgsHeader
      ? ["№ точки п/п", "№ точки по съемке", "x, м", "y, м", "H, м"]
      : Array.from({ length: detectedCols }, (_, i) => `Column ${i + 1}`);

  return {
    headers,
    rows: allRows,
    page_count: pageCount,
    parser_used: "fast",
    source_filename: resolvedName,
  };
}
