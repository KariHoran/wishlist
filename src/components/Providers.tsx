"use client";

import { SessionProvider } from "next-auth/react";
import { NetworkProvider } from "@/components/NetworkProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NetworkProvider>{children}</NetworkProvider>
    </SessionProvider>
  );
}
