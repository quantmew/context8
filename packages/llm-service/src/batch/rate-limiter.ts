/**
 * Rate Limiter - controls API request rate
 */

export interface RateLimiterConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum burst size */
  maxBurst?: number;
}

export class RateLimiter {
  private requestsPerSecond: number;
  private maxBurst: number;
  private tokens: number;
  private lastRefill: number;

  constructor(config: RateLimiterConfig) {
    this.requestsPerSecond = config.requestsPerSecond;
    this.maxBurst = config.maxBurst ?? config.requestsPerSecond;
    this.tokens = this.maxBurst;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a token, waiting if necessary
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    // Wait for a token to become available
    const waitTime = (1 / this.requestsPerSecond) * 1000;
    await this.sleep(waitTime);

    // Refill and try again
    this.refill();
    this.tokens--;
  }

  /**
   * Try to acquire a token without waiting
   * Returns true if acquired, false if rate limited
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }

    return false;
  }

  /**
   * Get current available tokens
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const refillAmount = (elapsed / 1000) * this.requestsPerSecond;

    this.tokens = Math.min(this.maxBurst, this.tokens + refillAmount);
    this.lastRefill = now;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
