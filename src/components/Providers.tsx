"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { NetworkProvider } from "@/components/NetworkProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

function SentryUserSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const userId = session?.user?.id;
    if (userId) {
      // Internal id only — no email/name (PII).
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }, [session?.user?.id]);

  return children;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SentryUserSync>
        <AppErrorBoundary>
          <NetworkProvider>
            <ServiceWorkerRegister />
            {children}
          </NetworkProvider>
        </AppErrorBoundary>
      </SentryUserSync>
    </SessionProvider>
  );
}
