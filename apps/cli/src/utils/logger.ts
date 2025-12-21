/**
 * Logger - CLI logging utilities with progress display
 */

import ora, { type Ora } from 'ora';
import chalk from 'chalk';

export class Logger {
  private spinner: Ora | null = null;
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    console.log(chalk.blue('ℹ'), message);
    if (this.spinner) {
      this.spinner.start();
    }
  }

  /**
   * Log a success message
   */
  success(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    } else {
      console.log(chalk.green('✓'), message);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: unknown): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    } else {
      console.error(chalk.red('✗'), message);
    }

    if (error && this.verbose) {
      console.error(error);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    console.log(chalk.yellow('⚠'), message);
    if (this.spinner) {
      this.spinner.start();
    }
  }

  /**
   * Log a debug message (only in verbose mode)
   */
  debug(message: string): void {
    if (this.verbose) {
      console.log(chalk.gray('⋮'), chalk.gray(message));
    }
  }

  /**
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.spinner = ora(message).start();
  }

  /**
   * Update spinner text
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop the spinner
   */
  stopSpinner(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  /**
   * Complete spinner with success
   */
  completeSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Fail spinner with error
   */
  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Log a blank line
   */
  newLine(): void {
    console.log();
  }

  /**
   * Log a table
   */
  table(data: Record<string, string>[]): void {
    console.table(data);
  }

  /**
   * Format file count
   */
  formatCount(count: number, singular: string, plural?: string): string {
    const p = plural ?? `${singular}s`;
    return `${count} ${count === 1 ? singular : p}`;
  }

  /**
   * Format duration
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(verbose = false): Logger {
  return new Logger(verbose);
}
