export type DelimiterOption = ";" | "," | "\t";

export type EncodingOption = "utf-8-sig" | "cp1251" | "utf-8";

export type ParserMode = "fast" | "ai";

import {
  generateCsvBlobClientSide,
  parsePdfClientSide,
} from "./clientParser";

export interface TableData {
  headers: string[];
  rows: string[][];
  page_count: number;
  parser_used: ParserMode;
  source_filename?: string | null;
}

export interface ParseRequest {
  file: File | Blob;
  filename?: string;
  mode?: ParserMode;
}

export interface ExportOptions {
  delimiter: DelimiterOption;
  encoding: EncodingOption;
  include_headers: boolean;
  filename: string;
}

export interface ExportRequest {
  table: TableData;
  options: ExportOptions;
}

export const DEFAULT_CLOUD_API_URL = "https://pfrtocsv.vercel.app/api/v1";
export const DEFAULT_LOCAL_API_URL = "http://localhost:8000/api/v1";

function resolveDefaultBaseUrl(): string {
  // Check Vite environment variable if available
  try {
    const envUrl = (import.meta as unknown as { env?: Record<string, string> })
      ?.env?.VITE_API_URL;
    if (envUrl) {
      return envUrl;
    }
  } catch {
    // Ignore if import.meta is not available
  }

  // In a deployed browser environment (e.g., https://*.vercel.app), use relative /api/v1
  if (
    typeof window !== "undefined" &&
    (window.location.protocol === "https:" ||
      (window.location.protocol === "http:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"))
  ) {
    return `${window.location.origin}/api/v1`;
  }

  // Inside Chrome Extension (chrome-extension://), use cloud API by default (with local fallback)
  if (
    typeof window !== "undefined" &&
    window.location.protocol === "chrome-extension:"
  ) {
    return DEFAULT_CLOUD_API_URL;
  }

  return DEFAULT_LOCAL_API_URL;
}

export class Pdf2CsvApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = resolveDefaultBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async _fetchWithFallback(
    endpointPath: string,
    init: RequestInit
  ): Promise<Response> {
    const primaryUrl = `${this.baseUrl}${endpointPath}`;
    try {
      return await fetch(primaryUrl, init);
    } catch (primaryErr) {
      const fallbackBase =
        this.baseUrl === DEFAULT_LOCAL_API_URL
          ? DEFAULT_CLOUD_API_URL
          : DEFAULT_LOCAL_API_URL;
      try {
        return await fetch(`${fallbackBase}${endpointPath}`, init);
      } catch {
        throw primaryErr;
      }
    }
  }

  /**
   * Unified helper to upload and parse a PDF using either "fast" or "ai" mode.
   */
  async uploadPdf(request: ParseRequest): Promise<TableData> {
    const mode = request.mode ?? "fast";
    if (mode === "ai") {
      return this.parseAi(request.file, request.filename);
    }
    return this.parseStandard(request.file, request.filename);
  }

  /**
   * POST /api/v1/parse/fast — Vector table extraction via pdfplumber.
   */
  async parseStandard(file: File | Blob, filename?: string): Promise<TableData> {
    return this._postPdf("/parse/fast", file, filename);
  }

  /**
   * POST /api/v1/parse/ai — Multimodal table extraction via Gemini Flash Structured Outputs.
   */
  async parseAi(file: File | Blob, filename?: string): Promise<TableData> {
    return this._postPdf("/parse/ai", file, filename);
  }

  /**
   * POST /api/v1/export/csv — Exports modified TableData to a CSV Blob with chosen delimiter & encoding.
   */
  async exportCsv(table: TableData, options: Partial<ExportOptions> = {}): Promise<Blob> {
    const resolvedOptions: ExportOptions = {
      delimiter: options.delimiter ?? ";",
      encoding: options.encoding ?? "utf-8-sig",
      include_headers: options.include_headers ?? true,
      filename: options.filename ?? "extracted_table.csv",
    };
    const payload: ExportRequest = {
      table,
      options: resolvedOptions,
    };

    try {
      const response = await this._fetchWithFallback("/export/csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return response.blob();
      }
    } catch {
      // Fall back to client-side CSV generation
    }

    return generateCsvBlobClientSide(table, resolvedOptions);
  }

  private async _postPdf(endpointPath: string, file: File | Blob, filename?: string): Promise<TableData> {
    const formData = new FormData();
    const resolvedName =
      filename || (file instanceof File ? file.name : "document.pdf");
    formData.append("file", file, resolvedName);

    try {
      const response = await this._fetchWithFallback(endpointPath, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        return (await response.json()) as TableData;
      }
    } catch {
      // Fall back to client-side PDF table extraction
    }

    return parsePdfClientSide(file, resolvedName);
  }

  private async _extractError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data?.detail ? JSON.stringify(data.detail) : response.statusText;
    } catch {
      return response.statusText;
    }
  }
}

export const defaultApiClient = new Pdf2CsvApiClient();
