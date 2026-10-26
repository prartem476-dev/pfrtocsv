import React from "react";
import {
  Plus,
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
    onChange({ ...table, headers: nextHeaders, rows: nextRows });
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
    onChange({ ...table, rows: nextRows });
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
            <Columns className="size-3.5 text-emerald-600" />
            {table.headers.length} кол.
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <Rows3 className="size-3.5 text-emerald-600" />
            {table.rows.length} стр.
          </span>
          <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
            Движок: {table.parser_used === "ai" ? "Gemini Flash AI" : "pdfplumber (Вектор)"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {table.rows.length > 0 && (
            <button
              type="button"
              onClick={handlePromoteFirstRowToHeader}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              title="Сделать первую строку таблицы заголовками колонок"
            >
              <ArrowUpToLine className="size-3.5 text-slate-500" />
              Строку 1 в шапку
            </button>
          )}
          <button
            type="button"
            onClick={handleAddColumn}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Plus className="size-3.5 text-emerald-600" />
            Колонка
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Plus className="size-3.5 text-emerald-600" />
            Строка
          </button>
        </div>
      </div>

      {/* Spreadsheet Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/80">
              <th className="w-10 border-r border-slate-200 px-2 py-2 text-center font-semibold text-slate-500">
                #
              </th>
              {table.headers.map((header, colIdx) => (
                <th
                  key={colIdx}
                  className="min-w-[140px] border-r border-slate-200 p-0 align-middle"
                >
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <input
                      type="text"
                      value={header}
                      aria-label={`Название колонки ${colIdx + 1}`}
                      onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                      className="w-full rounded bg-transparent px-1 py-0.5 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    {table.headers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Удалить колонку ${header}`}
                        onClick={() => handleDeleteColumn(colIdx)}
                        className="flex size-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-9 px-1 py-2 text-center font-normal text-slate-400">
                <span className="sr-only">Действия</span>
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
                  className="group hover:bg-emerald-50/30"
                >
                  <td className="border-r border-slate-200 bg-slate-50/60 px-2 py-1.5 text-center font-mono text-[11px] text-slate-400">
                    {rowIdx + 1}
                  </td>
                  {table.headers.map((_, colIdx) => {
                    const cellValue = row[colIdx] ?? "";
                    return (
                      <td
                        key={colIdx}
                        className="border-r border-slate-200 p-0 align-middle"
                      >
                        <input
                          type="text"
                          value={cellValue}
                          aria-label={`Строка ${rowIdx + 1}, колонка ${table.headers[colIdx]}`}
                          onChange={(e) =>
                            handleCellChange(rowIdx, colIdx, e.target.value)
                          }
                          className="w-full bg-transparent px-2.5 py-1.5 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600"
                        />
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      aria-label={`Удалить строку ${rowIdx + 1}`}
                      onClick={() => handleDeleteRow(rowIdx)}
                      className="inline-flex size-6 items-center justify-center rounded text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-600"
                    >
                      <Trash2 className="size-3.5" />
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
