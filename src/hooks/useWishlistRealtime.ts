"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useWishlistRealtime(wishlistId: string) {
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource(`/api/wishlists/${wishlistId}/events`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === "update") {
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, [wishlistId, router]);
}
