import React from "react";
import { Download, FileSpreadsheet, Settings2 } from "lucide-react";
import type { DelimiterOption, EncodingOption, ExportOptions } from "@pdf2csv/api-client";
import { cn } from "./utils";

export interface ExportSettingsProps {
  options: ExportOptions;
  onChange: (next: ExportOptions) => void;
  onExport: () => void;
  isExporting?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export const ExportSettings: React.FC<ExportSettingsProps> = ({
  options,
  onChange,
  onExport,
  isExporting = false,
  disabled = false,
  compact = false,
  className,
}) => {
  const handleDelimiterChange = (delimiter: DelimiterOption) => {
    onChange({ ...options, delimiter });
  };

  const handleEncodingChange = (encoding: EncodingOption) => {
    onChange({ ...options, encoding });
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Settings2 className="size-4 text-emerald-600" />
          <span>Параметры Excel / CSV</span>
        </div>

        {/* Delimiter Selector */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>Разделитель:</span>
          <select
            value={options.delimiter}
            onChange={(e) => handleDelimiterChange(e.target.value as DelimiterOption)}
            className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value=";">Точка с запятой ( ; ) — Excel RU</option>
            <option value=",">Запятая ( , ) — Стандарт US</option>
            <option value="&#9;">Табуляция ( Tab ) — TSV</option>
          </select>
        </label>

        {/* Encoding Selector */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>Кодировка:</span>
          <select
            value={options.encoding}
            onChange={(e) => handleEncodingChange(e.target.value as EncodingOption)}
            className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          >
            <option value="utf-8-sig">UTF-8 с BOM (Excel / 1С)</option>
            <option value="cp1251">Windows-1251 (Кириллица)</option>
            <option value="utf-8">UTF-8 (без BOM)</option>
          </select>
        </label>

        {/* Include Headers Toggle */}
        {!compact && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={options.include_headers}
              onChange={(e) =>
                onChange({ ...options, include_headers: e.target.checked })
              }
              className="size-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
            />
            <span>Включить заголовки</span>
          </label>
        )}
      </div>

      {/* Filename + Export CTA */}
      <div className="flex items-center gap-2">
        {!compact && (
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-4 text-slate-400" />
            <input
              type="text"
              value={options.filename}
              aria-label="Имя выходного CSV файла"
              onChange={(e) => onChange({ ...options, filename: e.target.value })}
              placeholder="table.csv"
              className="w-40 rounded border border-slate-300 px-2 py-1 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        )}

        <button
          type="button"
          onClick={onExport}
          disabled={disabled || isExporting}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
        >
          <Download className="size-3.5" />
          <span>{isExporting ? "Экспорт…" : "Скачать CSV"}</span>
        </button>
      </div>
    </div>
  );
};

// Alias ExportToolbar -> ExportSettings so both naming conventions work seamlessly
export const ExportToolbar = ExportSettings;
export type ExportToolbarProps = ExportSettingsProps;
