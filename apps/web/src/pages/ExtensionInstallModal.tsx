import React, { useEffect, useState } from "react";
import {
  X,
  Download,
  PanelRightOpen,
  ExternalLink,
  CheckCircle2,
  Bookmark,
  Sparkles,
  MonitorSmartphone,
} from "lucide-react";
import type { BeforeInstallPromptEvent } from "../main";

interface ExtensionInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSidePanelPreview: () => void;
}

export const ExtensionInstallModal: React.FC<ExtensionInstallModalProps> = ({
  isOpen,
  onClose,
  onOpenSidePanelPreview,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(
      () => window.__deferredPwaPrompt ?? null
    );
  const [isInstalledPwa, setIsInstalledPwa] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncPrompt = () => {
      setDeferredPrompt(window.__deferredPwaPrompt ?? null);
    };
    const onInstalled = () => {
      setIsInstalledPwa(true);
      window.__deferredPwaPrompt = null;
      setDeferredPrompt(null);
      setStatusMessage(
        "Приложение PDF2CSV AI установлено! Теперь оно доступно на рабочем столе и в chrome://apps."
      );
    };

    window.addEventListener("pwa-prompt-ready", syncPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalledPwa(true);
    }

    return () => {
      window.removeEventListener("pwa-prompt-ready", syncPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const origin = window.location.origin;

  // Self-contained bookmarklet that works even on websites with strict CSP
  // by directly toggling the right-hand iframe side panel.
  const bookmarkletCode = `javascript:(function(){var id='pdf2csv-ai-sidepanel-root',e=document.getElementById(id);if(e){e.remove();return;}var u=location.href,p=u.toLowerCase().indexOf('.pdf')!==-1||document.contentType==='application/pdf',src='${origin}/?mode=widget&embed=1'+(p?'&pdfUrl='+encodeURIComponent(u):'');var d=document.createElement('div');d.id=id;d.style.cssText='position:fixed;top:0;right:0;width:430px;max-width:95vw;height:100vh;z-index:2147483647;background:#fff;box-shadow:-8px 0 30px rgba(15,23,42,0.22);border-left:1px solid #e2e8f0;display:flex;flex-direction:column;font-family:system-ui,sans-serif;';var b=document.createElement('div');b.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0f172a;color:#fff;font-size:12px;font-weight:600;';b.innerHTML='<span>⚡ PDF2CSV AI · Боковая панель</span>';var c=document.createElement('button');c.textContent='✕';c.style.cssText='background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;padding:2px 6px;';c.onclick=function(){d.remove();};b.appendChild(c);var f=document.createElement('iframe');f.src=src;f.style.cssText='width:100%;flex:1;border:none;background:#f8fafc;';d.appendChild(b);d.appendChild(f);document.body.appendChild(d);})();`;

  const handleInstallPwaOrOpenMiniWindow = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalledPwa(true);
          window.__deferredPwaPrompt = null;
          setDeferredPrompt(null);
        }
        return;
      } catch {
        // Fallback to compact mini-window below
      }
    }

    // Immediate fallback: open standalone compact extension-style window
    window.open(
      `${origin}/?mode=widget`,
      "PDF2CSV_AI_Extension_Window",
      "width=440,height=680,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
    );
    setStatusMessage(
      "Открыто компактное окно расширения! Вы также можете нажать на иконку установки в правом краю адресной строки Chrome."
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-extension-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть окно установки"
          className="absolute top-4 right-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <h2
              id="install-extension-title"
              className="text-base font-bold text-slate-900"
            >
              Использовать как расширение Chrome (без .zip и магазинов)
            </h2>
            <p className="text-xs text-slate-500">
              Выберите удобный вариант запуска в 1 клик — обновления с Vercel приходят автоматически
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* VARIANT 1: 1-Click PWA / Standalone Mini-App */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Вариант 1 · В 1 клик
                </span>
                <MonitorSmartphone className="size-4 text-emerald-600" />
              </div>

              <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                Отдельное мини-окно (PWA-приложение)
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Устанавливает иконку <strong>PDF2CSV AI</strong> прямо в Chrome и на рабочий стол. Открывается в компактном окне расширения без адресной строки и вкладок.
              </p>

              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  <span>Официальная функция Chrome (без предупреждений)</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                  <span>Запуск с панели задач или ярлыка в 1 клик</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleInstallPwaOrOpenMiniWindow}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <Download className="size-4" />
                <span>
                  {deferredPrompt
                    ? "Установить приложение в 1 клик"
                    : isInstalledPwa
                      ? "Открыть компактное окно"
                      : "Запустить компактное окно"}
                </span>
              </button>
              <span className="text-center text-[10px] text-slate-400">
                {deferredPrompt
                  ? "Нативный установщик браузера готов"
                  : "Откроет мини-окно 440×680 поверх вкладок"}
              </span>
            </div>
          </div>

          {/* VARIANT 2: Bookmarklet Side-Panel on Any Website */}
          <div className="flex flex-col justify-between rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Вариант 2 · Поверх любого сайта
                </span>
                <PanelRightOpen className="size-4 text-slate-800" />
              </div>

              <h3 className="mt-2.5 text-sm font-bold text-slate-900">
                Выезжающая боковая панель в браузере
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Перетащите кнопку ниже мышкой на <strong>Панель закладок</strong> Chrome (<kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px]">Ctrl+Shift+B</kbd>). При клике на любом сайте справа выедет панель конвертера!
              </p>

              {/* Draggable Bookmarklet Pill */}
              <div className="mt-3 rounded-lg border border-dashed border-emerald-400 bg-white p-2.5 text-center">
                <p className="mb-1.5 text-[10px] font-medium text-slate-500">
                  Зажмите мышкой и перетащите наверх в закладки:
                </p>
                <a
                  ref={(el) => {
                    if (el) {
                      el.setAttribute("href", bookmarkletCode);
                    }
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    onClose();
                    onOpenSidePanelPreview();
                  }}
                  draggable
                  title="Перетащите эту кнопку на панель закладок Chrome"
                  className="inline-flex cursor-grab items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm ring-2 ring-emerald-500/30 transition hover:bg-slate-800 active:cursor-grabbing"
                >
                  <Bookmark className="size-3.5 text-emerald-400" />
                  <span>⚡ PDF2CSV Панель</span>
                </a>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSidePanelPreview();
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                <PanelRightOpen className="size-4 text-emerald-600" />
                <span>Протестировать боковую панель сейчас</span>
              </button>
              <span className="text-center text-[10px] text-slate-500">
                Работает во всех браузерах без скачивания файлов
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <span>
            Оба варианта напрямую подключены к вашему облаку на Vercel и обновляются мгновенно.
          </span>
          <a
            href="/?mode=widget"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
          >
            <span>Прямая ссылка на компактный виджет</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
