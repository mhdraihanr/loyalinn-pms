"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_REFRESH_INTERVAL_MS = 10 * 1000;

export function startPageAutoRefresh(options: {
  refresh: () => void;
  intervalMs?: number;
}) {
  const intervalMs = options.intervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const intervalId = setInterval(() => {
    options.refresh();
  }, intervalMs);

  return () => {
    clearInterval(intervalId);
  };
}

export function PageAutoRefresh({
  children,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: {
  children: React.ReactNode;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    return startPageAutoRefresh({
      refresh: () => router.refresh(),
      intervalMs,
    });
  }, [intervalMs, router]);

  return <>{children}</>;
}
