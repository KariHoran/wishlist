"use client";

import { useEffect } from "react";

/** Registers the minimal PWA service worker in production only. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("SW registration failed", err);
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(register, { timeout: 4000 });
    } else {
      window.setTimeout(register, 1500);
    }
  }, []);

  return null;
}
