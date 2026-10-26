import { defaultApiClient } from "@pdf2csv/api-client";

interface ExtractPdfMessage {
  type: "EXTRACT_PDF_URL_TO_CSV";
  pdfUrl: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtractPdfMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: {
      ok: boolean;
      csvDataUrl?: string;
      filename?: string;
      error?: string;
    }) => void
  ) => {
    if (message?.type !== "EXTRACT_PDF_URL_TO_CSV") {
      return false;
    }

    (async () => {
      try {
        const pdfResponse = await fetch(message.pdfUrl);
        if (!pdfResponse.ok) {
          throw new Error(`Не удалось скачать PDF (${pdfResponse.status})`);
        }
        const pdfBlob = await pdfResponse.blob();
        const urlPath = new URL(message.pdfUrl).pathname;
        const rawFilename = urlPath.split("/").pop() || "document.pdf";

        const tableData = await defaultApiClient.parseStandard(
          pdfBlob,
          rawFilename
        );
        const csvFilename = rawFilename.replace(/\.pdf$/i, "") + ".csv";
        const csvBlob = await defaultApiClient.exportCsv(tableData, {
          delimiter: ";",
          encoding: "utf-8-sig",
          include_headers: true,
          filename: csvFilename,
        });

        const buffer = await csvBlob.arrayBuffer();
        const base64Csv = arrayBufferToBase64(buffer);
        const csvDataUrl = `data:text/csv;charset=utf-8-sig;base64,${base64Csv}`;

        sendResponse({
          ok: true,
          csvDataUrl,
          filename: csvFilename,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Ошибка при обращении к API PDF2CSV",
        });
      }
    })();

    // Return true to indicate asynchronous sendResponse in Manifest V3 Service Worker
    return true;
  }
);
