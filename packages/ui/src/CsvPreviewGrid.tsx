import React, { useState } from "react";
import {
  Plus,
  Minus,
  Trash2,
  ArrowUpToLine,
  Columns,
  Rows3,
} from "lucide-react";
import type { TableData } from "@pdf2csv/api-client";
import { cn } from "./utils";

export interface CsvPreviewGridProps {
  table: TableData;
  onChange: (updated: TableData) => void;
  className?: string;
}

export const CsvPreviewGrid: React.FC<CsvPreviewGridProps> = ({
  table,
  onChange,
  className,
}) => {
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [activeColIndex, setActiveColIndex] = useState<number | null>(null);

  const handleHeaderChange = (colIndex: number, value: string) => {
    const nextHeaders = [...table.headers];
    nextHeaders[colIndex] = value;
    onChange({ ...table, headers: nextHeaders });
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = table.rows.map((row, rIdx) => {
      if (rIdx !== rowIndex) return row;
      const copy = [...row];
      copy[colIndex] = value;
      return copy;
    });
    onChange({ ...table, rows: nextRows });
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (table.headers.length <= 1) return;
    const nextHeaders = table.headers.filter((_, idx) => idx !== colIndex);
    const nextRows = table.rows.map((row) =>
      row.filter((_, idx) => idx !== colIndex)
    );
    setActiveColIndex((prev) => {
      if (prev === null) return null;
      if (prev === colIndex) return null;
      return prev > colIndex ? prev - 1 : prev;
    });
    onChange({ ...table, headers: nextHeaders, rows: nextRows });
  };

  const handleDeleteTargetColumn = () => {
    if (table.headers.length <= 1) return;
    const targetCol =
      activeColIndex !== null && activeColIndex < table.headers.length
        ? activeColIndex
        : table.headers.length - 1;
    handleDeleteColumn(targetCol);
  };

  const handleAddColumn = () => {
    const newColName = `Колонка ${table.headers.length + 1}`;
    const nextHeaders = [...table.headers, newColName];
    const nextRows = table.rows.map((row) => [...row, ""]);
    onChange({ ...table, headers: nextHeaders, rows: nextRows });
  };

  const handleAddRow = () => {
    const emptyRow = Array.from({ length: table.headers.length }, () => "");
    onChange({ ...table, rows: [...table.rows, emptyRow] });
  };

  const handleDeleteRow = (rowIndex: number) => {
    const nextRows = table.rows.filter((_, idx) => idx !== rowIndex);
    setActiveRowIndex((prev) => {
      if (prev === null) return null;
      if (prev === rowIndex) return null;
      return prev > rowIndex ? prev - 1 : prev;
    });
    onChange({ ...table, rows: nextRows });
  };

  const handleDeleteTargetRow = () => {
    if (table.rows.length === 0) return;
    const targetRow =
      activeRowIndex !== null && activeRowIndex < table.rows.length
        ? activeRowIndex
        : table.rows.length - 1;
    handleDeleteRow(targetRow);
  };

  const handlePromoteFirstRowToHeader = () => {
    if (table.rows.length === 0) return;
    const [firstRow, ...restRows] = table.rows;
    const nextHeaders = firstRow.map(
      (cell, idx) => cell.trim() || `Колонка ${idx + 1}`
    );
    onChange({
      ...table,
      headers: nextHeaders,
      rows: restRows,
    });
  };

  return (
    <div className={cn("flex flex-col rounded-lg border border-slate-200 bg-white", className)}>
      {/* Grid Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <Columns aria-hidden="true" className="size-3.5 text-emerald-600" />
            {table.headers.length} кол.
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <Rows3 aria-hidden="true" className="size-3.5 text-emerald-600" />
            {table.rows.length} стр.
          </span>
          <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
            Движок: {table.parser_used === "ai" ? "Gemini Flash AI" : "Вектор / OCR"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {table.rows.length > 0 && (
            <button
              type="button"
              onClick={handlePromoteFirstRowToHeader}
              className="inline-flex min-h-10 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:min-h-8"
              title="Сделать первую строку таблицы заголовками колонок"
            >
              <ArrowUpToLine aria-hidden="true" className="size-3.5 text-slate-500" />
              Строку 1 в шапку
            </button>
          )}
          <div className="inline-flex items-center rounded border border-slate-200 bg-white">
            <button
              type="button"
              onClick={handleAddColumn}
              title="Добавить новую колонку справа"
              className="inline-flex min-h-10 items-center gap-1 border-r border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:min-h-8"
            >
              <Plus aria-hidden="true" className="size-3.5 text-emerald-600" />
              Колонка
            </button>
            <button
              type="button"
              onClick={handleDeleteTargetColumn}
              disabled={table.headers.length <= 1}
              title={
                activeColIndex !== null && table.headers[activeColIndex]
                  ? `Удалить выбранную колонку «${table.headers[activeColIndex]}»`
                  : "Удалить последнюю колонку"
              }
              className="inline-flex min-h-10 items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 active:opacity-80 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:min-h-8"
            >
              <Minus aria-hidden="true" className="size-3.5" />
              Удалить кол.
            </button>
          </div>

          <div className="inline-flex items-center rounded border border-slate-200 bg-white">
            <button
              type="button"
              onClick={handleAddRow}
              title="Добавить новую строку в конец таблицы"
              className="inline-flex min-h-10 items-center gap-1 border-r border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:min-h-8"
            >
              <Plus aria-hidden="true" className="size-3.5 text-emerald-600" />
              Строка
            </button>
            <button
              type="button"
              onClick={handleDeleteTargetRow}
              disabled={table.rows.length === 0}
              title={
                activeRowIndex !== null
                  ? `Удалить выбранную строку №${activeRowIndex + 1}`
                  : "Удалить последнюю строку"
              }
              className="inline-flex min-h-10 items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 active:opacity-80 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 sm:min-h-8"
            >
              <Minus aria-hidden="true" className="size-3.5" />
              Удалить стр.
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80">
              <th className="w-16 border-r border-slate-200 px-2 py-2 text-center font-semibold text-slate-500">
                #
              </th>
              {table.headers.map((header, colIdx) => (
                <th
                  key={colIdx}
                  className={cn(
                    "min-w-[140px] border-r border-slate-200 p-0 align-middle transition-colors",
                    activeColIndex === colIdx && "bg-emerald-50/70"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <input
                      type="text"
                      value={header}
                      aria-label={`Название колонки ${colIdx + 1}`}
                      onFocus={() => setActiveColIndex(colIdx)}
                      onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                      className="min-h-9 w-full rounded bg-transparent px-1.5 py-1 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    {table.headers.length > 1 && (
                      <button
                        type="button"
                        title={`Удалить колонку «${header}»`}
                        aria-label={`Удалить колонку ${header}`}
                        onClick={() => handleDeleteColumn(colIdx)}
                        className="flex size-8 shrink-0 items-center justify-center rounded border border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600 sm:size-7"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="sticky right-0 w-11 border-l border-slate-200 bg-slate-100 px-1 py-2 text-center font-normal text-slate-500">
                <span className="sr-only">Удалить строку</span>
                <Trash2 aria-hidden="true" className="mx-auto size-3.5 text-slate-400" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {table.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.headers.length + 2}
                  className="px-4 py-8 text-center text-xs text-slate-500"
                >
                  В таблице пока нет строк. Нажмите «+ Строка» выше или загрузите другой PDF-документ.
                </td>
              </tr>
            ) : (
              table.rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    "group hover:bg-emerald-50/30",
                    activeRowIndex === rowIdx && "bg-emerald-50/40"
                  )}
                >
                  <td className="border-r border-slate-200 bg-slate-50/60 px-1.5 py-1 text-center font-mono text-[11px] text-slate-500">
                    <div className="flex items-center justify-between gap-1">
                      <span className="pl-1">{rowIdx + 1}</span>
                      <button
                        type="button"
                        title={`Удалить строку ${rowIdx + 1}`}
                        aria-label={`Удалить строку ${rowIdx + 1}`}
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="inline-flex size-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 active:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600"
                      >
                        <Trash2 aria-hidden="true" className="size-3" />
                      </button>
                    </div>
                  </td>
                  {table.headers.map((_, colIdx) => {
                    const cellValue = row[colIdx] ?? "";
                    return (
                      <td
                        key={colIdx}
                        className={cn(
                          "border-r border-slate-200 p-0 align-middle",
                          activeColIndex === colIdx && "bg-emerald-50/20"
                        )}
                      >
                        <input
                          type="text"
                          value={cellValue}
                          aria-label={`Строка ${rowIdx + 1}, колонка ${table.headers[colIdx]}`}
                          onFocus={() => {
                            setActiveRowIndex(rowIdx);
                            setActiveColIndex(colIdx);
                          }}
                          onChange={(e) =>
                            handleCellChange(rowIdx, colIdx, e.target.value)
                          }
                          className="min-h-10 w-full bg-transparent px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:min-h-8"
                        />
                      </td>
                    );
                  })}
                  <td className="sticky right-0 border-l border-slate-200 bg-white/95 px-1 py-1 text-center group-hover:bg-emerald-50/30">
                    <button
                      type="button"
                      title={`Удалить строку ${rowIdx + 1}`}
                      aria-label={`Удалить строку ${rowIdx + 1}`}
                      onClick={() => handleDeleteRow(rowIdx)}
                      className="inline-flex size-8 items-center justify-center rounded border border-transparent text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600 sm:size-7"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
