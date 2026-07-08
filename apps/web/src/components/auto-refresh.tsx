"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server-component data on an interval (realtime views). */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
