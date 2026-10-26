import { useState } from "react";
import {
  defaultApiClient,
  type ExportOptions,
  type ParserMode,
  type TableData,
} from "@pdf2csv/api-client";

export function usePdfWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [parserMode, setParserMode] = useState<ParserMode>("fast");
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

  const parseFile = async (targetFile: File, mode: ParserMode) => {
    setIsParsing(true);
    setError(null);
    try {
      const result = await defaultApiClient.uploadPdf({
        file: targetFile,
        filename: targetFile.name,
        mode,
      });
      setTable(result);
      const baseName = targetFile.name.replace(/\.pdf$/i, "");
      setExportOptions((prev) => ({
        ...prev,
        filename: `${baseName || "table"}.csv`,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось обработать PDF-файл.";
      setError(message);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    const nextUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setPdfPreviewUrl(nextUrl);
    await parseFile(selectedFile, parserMode);
  };

  const handleModeChange = async (nextMode: ParserMode) => {
    setParserMode(nextMode);
    if (file) {
      await parseFile(file, nextMode);
    }
  };

  const handleLoadSamplePdf = async () => {
    setIsParsing(true);
    setError(null);
    try {
      const response = await fetch("/sample_invoice_ru.pdf");
      if (!response.ok) {
        throw new Error("Не удалось загрузить демонстрационный PDF-счёт.");
      }
      const blob = await response.blob();
      const demoFile = new File([blob], "счет_142_демо.pdf", {
        type: "application/pdf",
      });
      await handleFileSelect(demoFile);
    } catch (err) {
      setIsParsing(false);
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки демо-счёта."
      );
    }
  };

  const handleLoadSampleKgsPdf = async () => {
    setIsParsing(true);
    setError(null);
    try {
      const response = await fetch("/sample_kgs_ru.pdf");
      if (!response.ok) {
        throw new Error("Не удалось загрузить демонстрационный каталог КГС.");
      }
      const blob = await response.blob();
      const demoFile = new File([blob], "каталог_координат_КГС_3906-25.pdf", {
        type: "application/pdf",
      });
      await handleFileSelect(demoFile);
    } catch (err) {
      setIsParsing(false);
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки демо КГС."
      );
    }
  };

  const handleExportCsv = async () => {
    if (!table) return;
    setIsExporting(true);
    setError(null);
    try {
      const csvBlob = await defaultApiClient.exportCsv(table, exportOptions);
      const downloadUrl = URL.createObjectURL(csvBlob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = exportOptions.filename.endsWith(".csv")
        ? exportOptions.filename
        : `${exportOptions.filename}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось экспортировать CSV."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return {
    file,
    pdfPreviewUrl,
    parserMode,
    table,
    setTable,
    isParsing,
    isExporting,
    error,
    exportOptions,
    setExportOptions,
    handleFileSelect,
    handleModeChange,
    handleLoadSamplePdf,
    handleLoadSampleKgsPdf,
    handleExportCsv,
  };
}
