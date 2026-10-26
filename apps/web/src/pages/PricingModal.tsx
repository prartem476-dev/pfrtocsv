import React from "react";
import { Check, X } from "lucide-react";

export interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPro: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  onSelectPro,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <h2
              id="pricing-modal-title"
              className="text-balance text-lg font-bold text-slate-900"
            >
              Тарифы PDF2CSV AI для бухгалтерии и аналитики
            </h2>
            <p className="mt-1 text-pretty text-xs text-slate-600">
              Сравнение бесплатного векторного парсера и мультимодального ИИ-движка Gemini Flash
            </p>
          </div>
          <button
            type="button"
            aria-label="Закрыть окно тарифов"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Free Plan */}
          <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div>
              <span className="inline-block rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800">
                Базовый
              </span>
              <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
                0 ₽ <span className="text-xs font-normal text-slate-500">/ навсегда</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Для стандартных цифровых PDF из 1С, ЭДО и клиент-банков.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Мгновенное векторное извлечение (pdfplumber)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Интерактивное редактирование ячеек и шапки</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Экспорт в Excel (UTF-8 с BOM и Windows-1251)</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Текущий тариф
            </button>
          </div>

          {/* PRO Plan */}
          <div className="flex flex-col justify-between rounded-lg border-2 border-emerald-600 bg-white p-4">
            <div>
              <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                PRO · AI Smart Parser
              </span>
              <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
                1 990 ₽ <span className="text-xs font-normal text-slate-500">/ мес.</span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Для сканов, фото чеков и сложных многострочных банковских выписок.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Мультимодальный парсинг Gemini Flash (Structured JSON)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Распознавание сканов, печатей и таблиц без границ</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600 shrink-0" />
                  <span>Chrome-расширение с перехватом PDF в один клик</span>
                </li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectPro();
                onClose();
              }}
              className="mt-5 w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Включить AI Smart Parser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
