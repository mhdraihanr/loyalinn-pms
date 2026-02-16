export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  reservationId?: string;
  jobId?: string;
  eventId?: string;
};

export type ErrorCategory =
  | "validation"
  | "integration"
  | "retryable"
  | "fatal";

export type LogEntry = {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  errorCategory?: ErrorCategory;
  timestamp: string;
  metadata?: Record<string, unknown>;
};
