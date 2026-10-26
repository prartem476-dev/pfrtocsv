import React, { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Sparkles,
  Zap,
  AlertCircle,
  FileText,
  CreditCard,
  Download,
  PanelRightOpen,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Dropzone, CsvPreviewGrid, ExportSettings } from "@pdf2csv/ui";
import { usePdfWorkspace } from "../hooks/usePdfWorkspace";
import { PricingModal } from "./PricingModal";
import { ExtensionInstallModal } from "./ExtensionInstallModal";

export const WorkspacePage: React.FC = () => {
  const {
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
  } = usePdfWorkspace();

  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isWidgetMode, setIsWidgetMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("mode") === "widget" ||
      window.matchMedia("(display-mode: standalone)").matches
    );
  });

  // Trigger the live bookmarklet side-panel preview right on the current page
  const handleToggleSidePanelPreview = () => {
    const existing = document.getElementById("pdf2csv-ai-sidepanel-root");
    if (existing) {
      existing.remove();
      return;
    }
    const script = document.createElement("script");
    script.src = `/widget.js?t=${Date.now()}`;
    document.body.appendChild(script);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("install") === "1") {
      setIsInstallModalOpen(true);
    }
  }, []);

  // COMPACT CHROME EXTENSION / PWA / SIDE-PANEL MODE
  if (isWidgetMode) {
    return (
      <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-3.5 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white">
                <FileSpreadsheet className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-bold text-slate-900">
                    PDF2CSV AI
                  </h1>
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Виджет
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Экспорт PDF в Excel / CSV (; · UTF-8 BOM)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsWidgetMode(false)}
              title="Развернуть в полный двухпанельный режим"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              <Maximize2 className="size-3" />
              <span>Split-View</span>
            </button>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-3 p-3">
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleModeChange("fast")}
              className={`inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
                parserMode === "fast"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Zap className="size-3.5 text-emerald-600" />
              <span>Fast (Бесплатно)</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange("ai")}
              className={`inline-flex items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition ${
                parserMode === "ai"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>AI Smart (Сканы)</span>
            </button>
          </div>

          {/* Dropzone + Demo Shortcuts */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">
                Загрузите PDF-файл
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleLoadSampleKgsPdf}
                  disabled={isParsing}
                  className="font-medium text-emerald-700 hover:underline disabled:opacity-50"
                >
                  Демо КГС
                </button>
                <button
                  type="button"
                  onClick={handleLoadSamplePdf}
                  disabled={isParsing}
                  className="font-medium text-slate-600 hover:underline disabled:opacity-50"
                >
                  Демо Счёт
                </button>
              </div>
            </div>

            <Dropzone
              onFileSelect={handleFileSelect}
              isLoading={isParsing}
              currentFile={file}
              compact
            />

            {error && (
              <div
                role="alert"
                className="mt-2 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="text-pretty">{error}</span>
              </div>
            )}
          </div>

          <ExportSettings
            options={exportOptions}
            onChange={setExportOptions}
            onExport={handleExportCsv}
            isExporting={isExporting}
            disabled={!table || table.rows.length === 0}
          />

          {isParsing ? (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
              <div className="h-7 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-7 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ) : table ? (
            <CsvPreviewGrid
              table={table}
              onChange={setTable}
              className="flex-1"
            />
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-600 text-white">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-balance text-sm font-bold text-slate-900">
                  PDF2CSV AI
                </h1>
                <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Excel · 1С Ready
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Гибридный конвертер счетов и выписок в CSV (UTF-8 BOM / Win-1251)
              </p>
            </div>
          </div>

          {/* Parser Mode Switcher & 1-Click Extension Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="Режим распознавания PDF"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              <button
                type="button"
                onClick={() => handleModeChange("fast")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  parserMode === "fast"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap className="size-3.5 text-emerald-600" />
                <span>Fast Parser (Free)</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("ai")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                  parserMode === "ai"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>AI Smart Parser (PRO — сканы и сложные таблицы)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsWidgetMode(true)}
              title="Переключить в компактный режим расширения"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Minimize2 className="size-3.5 text-slate-500" />
              <span className="hidden sm:inline">Компактный вид</span>
            </button>

            <button
              type="button"
              onClick={() => setIsInstallModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs transition hover:bg-emerald-100"
            >
              <Download className="size-3.5 text-emerald-600" />
              <span>Установить в Chrome</span>
              <span className="rounded bg-emerald-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                1 клик
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsPricingOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <CreditCard className="size-3.5 text-slate-500" />
              <span>Тарифы</span>
            </button>
          </div>
        </div>
      </header>

      {/* Top Quick-Access Extension Banner */}
      <div className="border-b border-emerald-200/80 bg-emerald-50/60 px-4 py-2">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <PanelRightOpen className="size-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Новинка:</strong> используйте PDF2CSV AI как расширение Chrome в 1 клик (отдельное мини-окно PWA или боковая панель поверх любого сайта — без скачивания .zip).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSidePanelPreview}
              className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <PanelRightOpen className="size-3.5" />
              <span>Открыть боковую панель</span>
            </button>
            <button
              type="button"
              onClick={() => setIsInstallModalOpen(true)}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
            >
              <span>Подключить в 1 клик →</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-12">
        {/* LEFT PANE: Upload & PDF Document Preview */}
        <section
          aria-label="Загрузка и предпросмотр PDF"
          className="flex flex-col gap-3 lg:col-span-5"
        >
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-balance text-xs font-semibold text-slate-800">
                Исходный PDF-документ
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLoadSampleKgsPdf}
                  disabled={isParsing}
                  className="text-xs font-medium text-emerald-700 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Демо: Каталог КГС (скан)
                </button>
                <button
                  type="button"
                  onClick={handleLoadSamplePdf}
                  disabled={isParsing}
                  className="text-xs font-medium text-slate-600 underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Демо: Счёт №142
                </button>
              </div>
            </div>

            <Dropzone
              onFileSelect={handleFileSelect}
              isLoading={isParsing}
              currentFile={file}
              compact={Boolean(file)}
            />

            {error && (
              <div
                role="alert"
                className="mt-2.5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">Ошибка обработки документа</p>
                  <p className="mt-0.5 text-pretty">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* PDF Native Preview Container */}
          <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 tabular-nums">
              <span className="font-medium text-slate-800">
                Предпросмотр страниц
              </span>
              {table && (
                <span>
                  Страниц в PDF: <strong>{table.page_count}</strong>
                </span>
              )}
            </div>

            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                title="Предпросмотр загруженного PDF-документа"
                className="h-full min-h-[460px] w-full flex-1 border-0"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <FileText className="size-6" />
                </div>
                <p className="mt-3 text-balance text-sm font-medium text-slate-800">
                  Документ ещё не выбран
                </p>
                <p className="mt-1 max-w-xs text-pretty text-xs text-slate-500">
                  Загрузите собственный PDF-файл выше или откройте тестовый бухгалтерский счёт на кириллице.
                </p>
                <button
                  type="button"
                  onClick={handleLoadSamplePdf}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Открыть демонстрационный счёт (PDF)
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANE: Interactive CSV Grid & Export Toolbar */}
        <section
          aria-label="Редактор таблицы и экспорт CSV"
          className="flex flex-col gap-3 lg:col-span-7"
        >
          <ExportSettings
            options={exportOptions}
            onChange={setExportOptions}
            onExport={handleExportCsv}
            isExporting={isExporting}
            disabled={!table || table.rows.length === 0}
          />

          {isParsing ? (
            <div className="flex flex-1 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
              <div className="space-y-2">
                <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ) : table ? (
            <CsvPreviewGrid
              table={table}
              onChange={setTable}
              className="flex-1"
            />
          ) : (
            <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <FileSpreadsheet className="size-6" />
              </div>
              <h2 className="mt-3 text-balance text-sm font-semibold text-slate-900">
                Интерактивная таблица предпросмотра CSV
              </h2>
              <p className="mt-1 max-w-md text-pretty text-xs text-slate-500">
                После загрузки PDF здесь появится таблица: вы сможете отредактировать ячейки, переименовать или удалить колонки и скачать файл с разделителем «;» для мгновенного открытия в Microsoft Excel.
              </p>
              <button
                type="button"
                onClick={handleLoadSamplePdf}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Проверить на демо-счёте №142
              </button>
            </div>
          )}
        </section>
      </main>

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        onSelectPro={() => handleModeChange("ai")}
      />

      <ExtensionInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        onOpenSidePanelPreview={handleToggleSidePanelPreview}
      />
    </div>
  );
};
