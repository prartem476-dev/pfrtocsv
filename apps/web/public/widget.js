/**
 * PDF2CSV AI — Universal Side-Panel Bookmarklet / Widget Loader
 * Opens a docked right-hand panel on any webpage without installing a .zip extension.
 */
(function () {
  var PANEL_ID = "pdf2csv-ai-sidepanel-root";
  var existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }

  var scriptEl = document.currentScript;
  var origin = "https://pfrtocsv.vercel.app";
  if (scriptEl && scriptEl.src) {
    try {
      origin = new URL(scriptEl.src).origin;
    } catch (e) {}
  } else if (window.__PDF2CSV_ORIGIN__) {
    origin = window.__PDF2CSV_ORIGIN__;
  }

  var currentUrl = window.location.href;
  var isPdf =
    currentUrl.toLowerCase().indexOf(".pdf") !== -1 ||
    document.contentType === "application/pdf";

  var iframeUrl =
    origin +
    "/?mode=widget&embed=1" +
    (isPdf ? "&pdfUrl=" + encodeURIComponent(currentUrl) : "");

  var container = document.createElement("div");
  container.id = PANEL_ID;
  container.style.cssText =
    "position:fixed;top:0;right:0;width:430px;max-width:95vw;height:100vh;z-index:2147483647;background:#ffffff;box-shadow:-8px 0 30px rgba(15,23,42,0.22);border-left:1px solid #e2e8f0;display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;transition:transform 0.2s ease;";

  var bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#0f172a;color:#ffffff;font-size:12px;font-weight:600;user-select:none;";

  var title = document.createElement("div");
  title.style.cssText = "display:flex;align-items:center;gap:8px;";
  title.innerHTML =
    '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;"></span><span>PDF2CSV AI · Боковая панель</span>';

  var actions = document.createElement("div");
  actions.style.cssText = "display:flex;align-items:center;gap:6px;";

  var popBtn = document.createElement("button");
  popBtn.type = "button";
  popBtn.textContent = "В новом окне ↗";
  popBtn.style.cssText =
    "background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:5px;padding:3px 8px;font-size:11px;cursor:pointer;";
  popBtn.onclick = function () {
    window.open(
      origin + "/?mode=widget",
      "PDF2CSV_AI_Widget",
      "width=440,height=680,menubar=no,toolbar=no,location=no,status=no"
    );
    container.remove();
  };

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "✕";
  closeBtn.title = "Закрыть панель";
  closeBtn.style.cssText =
    "background:transparent;color:#94a3b8;border:none;border-radius:5px;padding:2px 7px;font-size:14px;cursor:pointer;line-height:1;";
  closeBtn.onclick = function () {
    container.remove();
  };

  actions.appendChild(popBtn);
  actions.appendChild(closeBtn);
  bar.appendChild(title);
  bar.appendChild(actions);

  var iframe = document.createElement("iframe");
  iframe.src = iframeUrl;
  iframe.allow = "clipboard-read; clipboard-write";
  iframe.style.cssText = "width:100%; flex:1; border:none; background:#f8fafc;";

  container.appendChild(bar);
  container.appendChild(iframe);
  document.body.appendChild(container);
})();
