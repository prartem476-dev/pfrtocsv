import React, { useRef, useState } from "react";
import { FileSpreadsheet, Upload, AlertCircle, FileCheck2 } from "lucide-react";
import { cn } from "./utils";

export interface DropzoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  currentFile?: File | null;
  compact?: boolean;
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  isLoading = false,
  currentFile = null,
  compact = false,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateAndSelect = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setLocalError("Выберите файл в формате PDF (.pdf).");
      return;
    }
    setLocalError(null);
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    validateAndSelect(droppedFile);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    validateAndSelect(selected);
    e.target.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label="Загрузить PDF-документ для извлечения таблиц"
        onClick={() => !isLoading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isLoading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2",
          compact ? "px-4 py-5" : "px-6 py-8",
          isDragging
            ? "border-emerald-600 bg-emerald-50/70"
            : "border-slate-300 bg-white hover:border-emerald-600 hover:bg-slate-50/80",
          isLoading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="mb-3 flex size-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700">
          {currentFile ? (
            <FileCheck2 className="size-5 text-emerald-600" />
          ) : isLoading ? (
            <FileSpreadsheet className="size-5" />
          ) : (
            <Upload className="size-5" />
          )}
        </div>

        <p className="text-balance text-center text-sm font-medium text-slate-900">
          {isLoading
            ? "Извлечение таблицы из PDF…"
            : currentFile
              ? currentFile.name
              : "Перетащите PDF-счёт или выписку сюда либо нажмите для выбора"}
        </p>

        <p className="mt-1 text-pretty text-center text-xs text-slate-500 tabular-nums">
          {currentFile
            ? `${(currentFile.size / 1024).toFixed(1)} КБ · Нажмите, чтобы заменить файл`
            : "Поддерживаются цифровые PDF и отсканированные документы (.pdf)"}
        </p>
      </div>

      {localError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}
    </div>
  );
};
