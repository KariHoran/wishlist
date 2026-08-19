"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

/** Browser-only online status. Initial true avoids SSR/client hydration mismatch;
 * real navigator.onLine is applied in useEffect after mount. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    queueMicrotask(() => setIsOnline(navigator.onLine));

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    const poll = window.setInterval(() => {
      setIsOnline(navigator.onLine);
    }, 500);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(poll);
    };
  }, []);

  return isOnline;
}

type NetworkContextValue = {
  online: boolean;
  requireOnline: () => boolean;
  showToast: (message: string) => void;
};

const NetworkContext = createContext<NetworkContextValue>({
  online: true,
  requireOnline: () => true,
  showToast: () => {},
});

export function useNetwork() {
  return useContext(NetworkContext);
}

export function OfflineBanner({ visible }: { visible: boolean }) {
  const t = useTranslations("network");
  if (!visible) return null;
  return (
    <div className="offline-banner" role="status" aria-live="assertive">
      <span aria-hidden>⚠</span>
      <span>{t("banner")}</span>
    </div>
  );
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("network");
  const online = useOnlineStatus();
  const wasOffline = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      document.body.classList.add("is-offline");
      return;
    }
    document.body.classList.remove("is-offline");
    if (wasOffline.current) {
      wasOffline.current = false;
      setToast(t("restored"));
    }
  }, [online, t]);

  useEffect(() => {
    return () => document.body.classList.remove("is-offline");
  }, []);

  const requireOnline = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) return true;
    setToast(t("blocked"));
    return false;
  }, [t]);

  return (
    <NetworkContext.Provider value={{ online, requireOnline, showToast }}>
      <OfflineBanner visible={!online} />
      {children}
      {toast && (
        <div className="network-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </NetworkContext.Provider>
  );
}
