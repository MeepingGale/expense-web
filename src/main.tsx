import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const el = document.getElementById("root");
if (!el) throw new Error("#root not found");
createRoot(el).render(<App />);

// PWA: offline app shell. Prod only — a service worker in dev would fight HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Relative so it resolves under a subpath deploy (GH Pages) as well as at the root.
    navigator.serviceWorker.register("./sw.js").catch(() => { /* offline support is best-effort */ });
  });
}
