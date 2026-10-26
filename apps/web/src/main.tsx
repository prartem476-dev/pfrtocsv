import React from "react";
import ReactDOM from "react-dom/client";
import { WorkspacePage } from "./pages/WorkspacePage";
import "./index.css";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __deferredPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__deferredPwaPrompt = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration is optional
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorkspacePage />
  </React.StrictMode>
);
