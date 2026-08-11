"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

export function OfflineBanner() {
  const { online } = useNetwork();
  if (online) return null;
  return (
    <div className="offline-banner" role="status" aria-live="assertive">
      <span aria-hidden>⚠</span>
      <span>
        Нет соединения — изменения не сохранятся, пока не появится интернет
      </span>
    </div>
  );
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setOnline(navigator.onLine);

    function onOnline() {
      setOnline(true);
      setToast("Соединение восстановлено");
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const requireOnline = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) return true;
    setToast("Нет соединения — изменения не сохранятся, пока не появится интернет");
    return false;
  }, []);

  return (
    <NetworkContext.Provider value={{ online, requireOnline, showToast }}>
      {children}
      {toast && (
        <div className="network-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </NetworkContext.Provider>
  );
}
