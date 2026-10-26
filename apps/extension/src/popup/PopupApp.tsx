import React, { useState } from "react";
import {
  FileSpreadsheet,
  ExternalLink,
  AlertCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import { Dropzone, ExportToolbar, CsvPreviewGrid } from "@pdf2csv/ui";
import {
  defaultApiClient,
  type ExportOptions,
  type ParserMode,
  type TableData,
} from "@pdf2csv/api-client";

export const PopupApp: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ParserMode>("fast");
  const [table, setTable] = useState<TableData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    delimiter: ";",
    encoding: "utf-8-sig",
    include_headers: true,
    filename: "extracted_table.csv",
  });

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setIsParsing(true);
    setError(null);
    try {
      const result = await defaultApiClient.uploadPdf({
        file: selectedFile,
        filename: selectedFile.name,
        mode,
      });
      setTable(result);
      const baseName = selectedFile.name.replace(/\.pdf$/i, "");
      setExportOptions((prev) => ({
        ...prev,
        filename: `${baseName || "table"}.csv`,
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось подключиться к серверу PDF2CSV AI (http://localhost:8000)."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleExport = async () => {
    if (!table) return;
    setIsExporting(true);
    setError(null);
    try {
      const csvBlob = await defaultApiClient.exportCsv(table, exportOptions);
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exportOptions.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка скачивания CSV-файла."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3.5">
      {/* Popup Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded bg-emerald-600 text-white">
            <FileSpreadsheet className="size-4" />
          </div>
          <div>
            <h1 className="text-balance text-xs font-bold text-slate-900">
              PDF2CSV AI · Chrome Extension
            </h1>
            <p className="text-[10px] text-slate-500">
              Быстрый экспорт PDF-таблиц в Excel (; / UTF-8 BOM)
            </p>
          </div>
        </div>

        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
        >
          <span>Split-View</span>
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("fast")}
          className={`inline-flex items-center justify-center gap-1.5 rounded py-1 text-xs font-medium ${
            mode === "fast"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Zap className="size-3.5 text-emerald-600" />
          <span>Fast (Бесплатно)</span>
        </button>
        <button
          type="button"
          onClick={() => setMode("ai")}
          className={`inline-flex items-center justify-center gap-1.5 rounded py-1 text-xs font-medium ${
            mode === "ai"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="size-3.5" />
          <span>AI Smart (Сканы)</span>
        </button>
      </div>

      {/* Shared Dropzone Component */}
      <Dropzone
        onFileSelect={handleFileSelect}
        isLoading={isParsing}
        currentFile={file}
        compact
      />

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="text-pretty">{error}</span>
        </div>
      )}

      {/* Shared ExportToolbar Component */}
      <ExportToolbar
        options={exportOptions}
        onChange={setExportOptions}
        onExport={handleExport}
        isExporting={isExporting}
        disabled={!table || table.rows.length === 0}
        compact
      />

      {/* Compact Table Preview when parsed */}
      {table && (
        <div className="max-h-56 overflow-y-auto">
          <CsvPreviewGrid table={table} onChange={setTable} />
        </div>
      )}
    </div>
  );
};
