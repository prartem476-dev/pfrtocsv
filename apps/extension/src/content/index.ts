/**
 * Content Script: Detects when the active browser tab is viewing a PDF document
 * (.pdf URL or embedded application/pdf viewer) and injects a floating action button:
 * "Extract Table to CSV".
 */

function isPdfDocumentPage(): boolean {
  const url = window.location.href.toLowerCase();
  if (url.endsWith(".pdf") || url.includes(".pdf?") || url.includes(".pdf#")) {
    return true;
  }
  if (document.contentType === "application/pdf") {
    return true;
  }
  const embedPdf = document.querySelector('embed[type="application/pdf"]');
  return Boolean(embedPdf);
}

function injectExtractButton(): void {
  if (document.getElementById("pdf2csv-ai-fab")) return;

  const container = document.createElement("div");
  container.id = "pdf2csv-ai-fab";
  Object.assign(container.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: "2147483647",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  });

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Extract Table to CSV (PDF2CSV AI)";
  Object.assign(button.style, {
    backgroundColor: "#059669",
    color: "#ffffff",
    border: "1px solid #047857",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.18)",
  });

  button.addEventListener("click", () => {
    button.disabled = true;
    button.textContent = "Извлечение таблицы в CSV…";

    chrome.runtime.sendMessage(
      {
        type: "EXTRACT_PDF_URL_TO_CSV",
        pdfUrl: window.location.href,
      },
      (response?: { ok?: boolean; csvDataUrl?: string; filename?: string; error?: string }) => {
        button.disabled = false;
        if (chrome.runtime.lastError || !response?.ok || !response.csvDataUrl) {
          const errMsg =
            response?.error ||
            chrome.runtime.lastError?.message ||
            "Ошибка конвертации PDF.";
          button.textContent = `Ошибка: ${errMsg}`;
          setTimeout(() => {
            button.textContent = "Extract Table to CSV (PDF2CSV AI)";
          }, 4000);
          return;
        }

        const link = document.createElement("a");
        link.href = response.csvDataUrl;
        link.download = response.filename || "extracted_table.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();

        button.textContent = "CSV скачан ✓";
        setTimeout(() => {
          button.textContent = "Extract Table to CSV (PDF2CSV AI)";
        }, 2500);
      }
    );
  });

  container.appendChild(button);
  document.body.appendChild(container);
}

if (isPdfDocumentPage()) {
  injectExtractButton();
}
