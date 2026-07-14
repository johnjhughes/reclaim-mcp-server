/**
 * @fileoverview Common utilities for tests
 */

import * as api from "../../src/reclaim-client.js";
import type { Task } from "../../src/types/reclaim.js";
import { testLogger } from "./logger.js";

/**
 * Test configuration
 */
export const testConfig = {
  // Prefix for test task titles to identify test-created tasks
  taskPrefix: "[TEST]",

  // Delay between API calls to avoid rate limiting (increased to reduce rate limiting issues)
  apiCallDelay: 1500,

  // Default timeout for tests calling the API
  apiTimeout: 15000,
};

/**
 * Delay utility for tests
 * @param ms - Milliseconds to delay
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a unique test task title with timestamp
 */
export const generateTaskTitle = (testName: string): string => {
  const timestamp = new Date().getTime();
  return `${testConfig.taskPrefix} ${testName} (${timestamp})`;
};

/**
 * Call an API function with logging and delay to avoid rate limits
 * This avoids duplicating the API client while still providing logging
 */
export async function callWithLogging<T, Args extends unknown[]>(
  testName: string,
  functionName: string,
  apiFunction: (...args: Args) => Promise<T>,
  args: Args,
): Promise<T> {
  testLogger.step(testName, `Calling ${functionName} with args:`, args);

  try {
    const result = await apiFunction(...args);
    testLogger.apiCall(
      testName,
      functionName,
      typeof args[0] === "number" ? `/${args[0]}` : "",
      args,
      result,
    );

    // Add delay to avoid rate limiting
    await delay(testConfig.apiCallDelay);
    return result;
  } catch (error) {
    const errorMetadata =
      error instanceof Error
        ? (error as Error & { status?: unknown; detail?: unknown })
        : undefined;
    // More detailed error logging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
      stack: error instanceof Error ? error.stack : undefined,
      // Extra properties that might be useful for debugging API errors
      ...(errorMetadata && "status" in errorMetadata ? { status: errorMetadata.status } : {}),
      ...(errorMetadata && "detail" in errorMetadata ? { detail: errorMetadata.detail } : {}),
      raw: error, // Include the raw error object for complete details
    };

    testLogger.error(`${testName} - ${functionName} ERROR: ${errorDetails.message}`);
    testLogger.apiCall(
      testName,
      functionName,
      typeof args[0] === "number" ? `/${args[0]}` : "",
      args,
      undefined,
      errorDetails,
    );
    throw error;
  }
}

/**
 * Clean up any tasks created by tests
 */
export async function cleanupTestTasks(testName: string): Promise<void> {
  testLogger.step(testName, "Cleaning up test tasks");

  try {
    // Get all tasks
    const tasks = await api.listTasks();

    // Find tasks created by tests
    const testTasks = tasks.filter(
      (task) => task.title && task.title.startsWith(testConfig.taskPrefix),
    );

    if (testTasks.length === 0) {
      testLogger.step(testName, "No test tasks found to clean up");
      return;
    }

    testLogger.step(testName, `Found ${testTasks.length} test tasks to clean up`);

    // Delete each test task
    for (const task of testTasks) {
      testLogger.step(testName, `Deleting test task: ${task.title} (ID: ${task.id})`);
      await api.deleteTask(task.id);
      await delay(testConfig.apiCallDelay);
    }

    testLogger.step(testName, "Test task cleanup complete");
  } catch (error) {
    testLogger.error(
      `Error cleaning up test tasks: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Verify a task has the expected field values
 */
export function verifyTaskFields(
  testName: string,
  task: Task,
  expectedFields: Partial<Task>,
): boolean {
  let allMatch = true;

  for (const [field, expectedValue] of Object.entries(expectedFields)) {
    const actualValue = (task as unknown as Record<string, unknown>)[field];
    const matches = JSON.stringify(actualValue) === JSON.stringify(expectedValue);

    testLogger.assert(
      testName,
      `Field '${field}' should be '${JSON.stringify(expectedValue)}'`,
      matches,
      matches ? undefined : { expected: expectedValue, actual: actualValue },
    );

    if (!matches) {
      allMatch = false;
    }
  }

  return allMatch;
}

/**
 * Verify changes in a task before and after an operation
 */
export function verifyTaskChanges(
  testName: string,
  before: Task,
  after: Task,
  expectedChanges: Partial<Task>,
): boolean {
  let allChangesMatch = true;

  for (const [field, expectedValue] of Object.entries(expectedChanges)) {
    const beforeValue = (before as unknown as Record<string, unknown>)[field];
    const afterValue = (after as unknown as Record<string, unknown>)[field];

    const changeMatches = JSON.stringify(afterValue) === JSON.stringify(expectedValue);

    testLogger.assert(
      testName,
      `Field '${field}' should change from '${JSON.stringify(beforeValue)}' to '${JSON.stringify(expectedValue)}'`,
      changeMatches,
      { field, expected: expectedValue, actual: afterValue, before: beforeValue },
    );

    if (!changeMatches) {
      allChangesMatch = false;
    }
  }

  return allChangesMatch;
}
