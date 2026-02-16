import { LogLevel, LogContext, LogEntry, ErrorCategory } from "./types";

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // In production, send to logging service (e.g., Datadog, Sentry)
    // For now, use console with structured output
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.log("warn", message, metadata);
  }

  error(
    message: string,
    error?: Error,
    category?: ErrorCategory,
    metadata?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      level: "error",
      message,
      context: this.context,
      error,
      errorCategory: category,
      timestamp: new Date().toISOString(),
      metadata,
    };

    console.error(JSON.stringify(entry));
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "fatal",
      message,
      context: this.context,
      error,
      errorCategory: "fatal",
      timestamp: new Date().toISOString(),
      metadata,
    };

    console.error(JSON.stringify(entry));
  }
}

// Singleton instance
export const logger = new Logger();

// Helper to create logger with context
export function createLogger(context: LogContext): Logger {
  const contextLogger = new Logger();
  contextLogger.setContext(context);
  return contextLogger;
}
