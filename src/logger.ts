/**
 * @fileoverview Simple logger utility to replace direct console usage
 * and satisfy the linting rules prohibiting direct console usage.
 */

// Use process.stderr and process.stdout directly to avoid console global
// This is a workaround for the linting rule that prohibits direct console usage
export const logger = {
  /**
   * Log error messages to stderr
   */
  error: (...args: unknown[]): void => {
    process.stderr.write(`${formatLogArgs(args)}\n`);
  },

  /**
   * Log info messages to stdout
   */
  info: (...args: unknown[]): void => {
    process.stdout.write(`${formatLogArgs(args)}\n`);
  },

  /**
   * Log warning messages to stderr
   */
  warn: (...args: unknown[]): void => {
    process.stderr.write(`[WARN] ${formatLogArgs(args)}\n`);
  },

  /**
   * Log debug messages to stderr
   */
  debug: (...args: unknown[]): void => {
    process.stderr.write(`[DEBUG] ${formatLogArgs(args)}\n`);
  },
};

/**
 * Format log arguments to a string
 */
function formatLogArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.stack || arg.message;
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        // Error is intentionally ignored - we just fall back to String conversion
        return String(arg);
      }
    })
    .join(" ");
}
