import type { ErrorCategory } from "@/lib/observability/types";

const RETRY_DELAYS_IN_MINUTES = [1, 5, 15, 60] as const;

type CategorizedError = {
  category?: ErrorCategory;
};

export function classifyAutomationError(error: unknown): ErrorCategory {
  if (
    typeof error === "object" &&
    error !== null &&
    "category" in error &&
    typeof (error as CategorizedError).category === "string"
  ) {
    return (error as CategorizedError).category as ErrorCategory;
  }

  if (error instanceof SyntaxError || error instanceof TypeError) {
    return "validation";
  }

  return "integration";
}

export function getNextRetryAt(attempt: number, baseTime = new Date()): Date {
  const boundedAttempt = Math.min(
    Math.max(attempt, 1),
    RETRY_DELAYS_IN_MINUTES.length,
  );
  const delayInMinutes = RETRY_DELAYS_IN_MINUTES[boundedAttempt - 1];

  return new Date(baseTime.getTime() + delayInMinutes * 60 * 1000);
}

export function shouldDeadLetter(
  category: ErrorCategory,
  retryCount: number,
  maxRetries: number,
): boolean {
  if (category === "validation" || category === "fatal") {
    return true;
  }

  return retryCount >= maxRetries;
}
