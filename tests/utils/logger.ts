/**
 * @fileoverview Enhanced logging utility for test environments
 * Builds on the base logger with additional test-specific features
 */

import { randomUUID } from "node:crypto";
import { logger as baseLogger } from "../../src/logger.js";

// Log levels for filtering
export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
}

// Create a unique trace ID for this test run to correlate logs
export const TEST_RUN_ID = randomUUID().substring(0, 8);

interface LogOptions {
  testName?: string;
  traceId?: string;
  format?: "text" | "json";
}

/**
 * Enhanced logger for test environments with level control and formatting options
 */
export const testLogger = {
  ...baseLogger,

  // Current log level - defaults to INFO
  level: LogLevel.INFO,

  /**
   * Set the log level for filtering
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  },

  /**
   * Formats a log entry based on options
   */
  formatLog(level: string, message: string, data?: unknown, options: LogOptions = {}): string {
    const timestamp = new Date().toISOString();
    const testName = options.testName || "";
    const traceId = options.traceId || TEST_RUN_ID;

    if (options.format === "json") {
      return (
        JSON.stringify({
          timestamp,
          level,
          traceId,
          testName,
          message,
          data,
        }) + "\n"
      );
    }

    // Default text format
    let output = `[${timestamp}] [${level}]`;
    if (testName) output += ` [${testName}]`;
    if (traceId) output += ` [trace:${traceId}]`;
    output += ` ${message}`;

    if (data !== undefined) {
      if (typeof data === "string") {
        output += `\n  ${data}`;
      } else {
        output += `\n  ${JSON.stringify(data, null, 2)}`;
      }
    }

    return output;
  },

  /**
   * Log a test step with associated data
   */
  step(
    testName: string,
    message: string,
    data?: unknown,
    options: Omit<LogOptions, "testName"> = {},
  ): void {
    if (this.level < LogLevel.INFO) return;

    process.stderr.write(this.formatLog("STEP", message, data, { testName, ...options }) + "\n");
  },

  /**
   * Log a test assertion result
   */
  assert(
    testName: string,
    assertion: string,
    result: boolean,
    details?: unknown,
    options: Omit<LogOptions, "testName"> = {},
  ): void {
    if (this.level < LogLevel.INFO) return;

    const status = result ? "PASS" : "FAIL";
    process.stderr.write(
      this.formatLog(status, assertion, result ? undefined : details, { testName, ...options }) +
        "\n",
    );
  },

  /**
   * Log API call details
   */
  apiCall(
    testName: string,
    method: string,
    endpoint: string,
    requestData?: unknown,
    responseData?: unknown,
    error?: unknown,
    options: Omit<LogOptions, "testName"> = {},
  ): void {
    if (this.level < LogLevel.DEBUG) return;

    const message = `API ${method} ${endpoint}`;
    const data = {
      request: requestData,
      response: responseData,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    };

    process.stderr.write(this.formatLog("API", message, data, { testName, ...options }) + "\n");
  },

  /**
   * Log test suite start
   */
  suiteStart(suiteName: string, options: LogOptions = {}): void {
    if (this.level < LogLevel.INFO) return;

    process.stderr.write("\n\n");
    process.stderr.write("=".repeat(80) + "\n");
    process.stderr.write(
      this.formatLog("SUITE", `STARTING: ${suiteName}`, undefined, options) + "\n",
    );
    process.stderr.write("=".repeat(80) + "\n\n");
  },

  /**
   * Log test suite end with summary
   */
  suiteEnd(suiteName: string, passed: number, failed: number, options: LogOptions = {}): void {
    if (this.level < LogLevel.INFO) return;

    process.stderr.write("\n");
    process.stderr.write("=".repeat(80) + "\n");
    process.stderr.write(
      this.formatLog("SUITE", `COMPLETED: ${suiteName}`, { passed, failed }, options) + "\n",
    );
    process.stderr.write("=".repeat(80) + "\n\n");
  },
};
