/**
 * Retry utility with exponential backoff for handling transient failures
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Optional callback for logging retry attempts */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
};

/**
 * Check if an error is retryable based on error message patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Network errors - always retry
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('dns')
  ) {
    return true;
  }

  // Rate limiting - retry with backoff
  if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
    return true;
  }

  // Server errors (5xx) - retry
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }

  // Timeout errors - retry
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }

  return false;
}

/**
 * Sleep for the specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, backoffFactor } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const onRetry = options?.onRetry;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw lastError;
      }

      // Calculate next delay with jitter (±10%)
      const jitter = delay * 0.1 * (Math.random() * 2 - 1);
      const nextDelay = Math.min(delay + jitter, maxDelayMs);

      if (onRetry) {
        onRetry(attempt + 1, lastError, nextDelay);
      }

      await sleep(nextDelay);

      // Increase delay for next attempt
      delay = Math.min(delay * backoffFactor, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error('Retry failed');
}
