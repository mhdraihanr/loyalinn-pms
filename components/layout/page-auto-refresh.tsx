"use client";

const DEFAULT_REFRESH_INTERVAL_MS = 10 * 1000;

export function startPageAutoRefresh(_options: {
  refresh: () => void;
  intervalMs?: number;
}) {
  void _options;
  return () => {};
}

export function PageAutoRefresh({
  children,
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: {
  children: React.ReactNode;
  intervalMs?: number;
}) {
  void intervalMs;
  return <>{children}</>;
}
