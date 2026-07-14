/**
 * @fileoverview Provides a type-safe client for interacting with the Reclaim.ai REST API.
 * Handles API requests, responses, and basic error normalization.
 */

import axios, { type AxiosError, type AxiosInstance } from "axios";
import "dotenv/config";
import { logger } from "./logger.js";

// Fixed import path with .js extension
import { ReclaimError, type Task, type TaskInputData } from "./types/reclaim.js";

// --- Configuration ---

// --- Axios Instance ---

/**
 * Pre-configured Axios instance for making requests to the Reclaim.ai API.
 * Includes base URL and authorization header.
 */
// Define the API base URL with correct naming (camelCase)
const apiBaseUrl = "https://api.app.reclaim.ai/api/";

// Create our API client
export const reclaim: AxiosInstance = axios.create({
  // biome-ignore lint/style/useNamingConvention: This is an Axios property name that we can't change
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json", // Explicitly accept JSON responses
  },
  // Optional: Add a timeout for requests
  // timeout: 10000, // 10 seconds
});

reclaim.interceptors.request.use((config) => {
  const token = process.env.RECLAIM_API_KEY?.trim();
  if (!token) {
    throw new Error(
      "RECLAIM_API_KEY environment variable is not set. Set it before calling the Reclaim API.",
    );
  }

  config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

// --- Helper Functions ---

/**
 * Parses a deadline input into an ISO 8601 string suitable for the Reclaim API.
 * Handles inputs as number of days from now or a date/datetime string.
 * Defaults to 24 hours from the current time if parsing fails or input is invalid/missing.
 * Logic ported and refined from `prior-js-implementation.xml`.
 *
 * @param deadlineInput - The deadline specified as number of days from now,
 * an ISO 8601 date/time string, or undefined.
 * @returns An ISO 8601 date/time string representing the calculated deadline.
 */
/**
 * Parse a numeric deadline (days from now)
 */
function parseNumericDeadline(days: number): string {
  const now = new Date();

  // Handle non-positive days
  if (days <= 0) {
    logger.warn(
      `Received non-positive number of days "${days}" for deadline/snooze, using current time.`,
    );
    return now.toISOString();
  }

  // Calculate future date
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + days);
  return deadline.toISOString();
}

/**
 * Parse a string deadline (date/datetime)
 */
function parseStringDeadline(dateStr: string): string {
  // Try standard date parsing first
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split("-").map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    // Month is 0-indexed in Date.UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(utcDate.getTime())) {
      return utcDate.toISOString();
    }
  }

  throw new Error(`Invalid date format: "${dateStr}"`);
}

export function parseDeadline(deadlineInput: number | string | undefined): string {
  const now = new Date();
  try {
    // Handle by input type
    if (typeof deadlineInput === "number") {
      return parseNumericDeadline(deadlineInput);
    }

    if (typeof deadlineInput === "string") {
      return parseStringDeadline(deadlineInput);
    }

    // If deadlineInput is undefined or null, fall through to default
  } catch (error) {
    // Log the specific error during parsing before defaulting
    logger.error(
      `Failed to parse deadline/snooze input "${deadlineInput}", defaulting to 24 hours from now. Error: ${
        (error as Error).message
      }`,
    );
  }

  // Default case: 24 hours from now
  const defaultDeadline = new Date(now);
  defaultDeadline.setDate(defaultDeadline.getDate() + 1); // Add 1 day
  return defaultDeadline.toISOString();
}

/**
 * Filters an array of Task objects to include only those considered "active".
 *
 * **Important:** In Reclaim.ai, a task with `status: "COMPLETE"` means its scheduled time allocation
 * is finished, but the user may *not* have marked the task itself as done. These tasks
 * are considered "active" by this filter unless they are also `ARCHIVED`, `CANCELLED`, or `deleted`.
 *
 * Active tasks meet these criteria:
 * - `deleted` is `false`.
 * - `status` is **not** `ARCHIVED`.
 * - `status` is **not** `CANCELLED`.
 *
 * @param tasks - An array of `Task` objects.
 * @returns A new array containing only the active `Task` objects.
 */
export function filterActiveTasks(tasks: Task[]): Task[] {
  if (!Array.isArray(tasks)) {
    logger.error("filterActiveTasks received non-array input, returning empty array.");
    return [];
  }
  return tasks.filter(
    (task) =>
      task && // Ensure task object exists
      !task.deleted &&
      task.status !== "ARCHIVED" &&
      task.status !== "CANCELLED",
  );
}

/**
 * Converts convenience date fields and removes undefined values before an API write.
 */
function normalizeTaskPayload(
  taskData: TaskInputData,
  defaultDue: boolean,
): Partial<TaskInputData> {
  let payload: Partial<TaskInputData> = { ...taskData };

  if (payload.deadline !== undefined) {
    const { deadline, ...withoutDeadline } = payload;
    payload = { ...withoutDeadline, due: parseDeadline(deadline) };
  } else if (defaultDue && !payload.due) {
    payload.due = parseDeadline(undefined);
  }

  if (payload.snoozeUntil !== undefined) {
    payload.snoozeUntil = parseDeadline(payload.snoozeUntil);
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as Partial<TaskInputData>;
}

// --- API Methods ---

/**
 * Extract status, message, and detail from an Axios error
 */
function extractAxiosErrorInfo(error: AxiosError): {
  status: number | undefined;
  message: string;
  detail: unknown;
} {
  const status = error.response?.status;
  let message = error.message;
  let detail: unknown;

  // Try to extract response data for API errors
  const responseData = error.response?.data;
  if (responseData) {
    detail = responseData;
    // Try to use most specific message in order of preference
    if (typeof responseData === "object" && responseData !== null) {
      // Define a type for API error response
      type ErrorResponse = {
        message?: string;
        title?: string;
      };
      const errorData = responseData as ErrorResponse;

      if (errorData.message && errorData.title) {
        message = `${errorData.title}: ${errorData.message}`;
      } else if (errorData.message) {
        message = errorData.message;
      }
    } else if (typeof responseData === "string") {
      message = responseData;
    }
  }

  return { status, message, detail };
}

/**
 * Extract message and detail from a standard Error
 */
function extractErrorInfo(error: Error): {
  message: string;
  detail: unknown;
} {
  return {
    message: error.message,
    detail: { stack: error.stack }, // Include stack for non-API errors
  };
}

/**
 * Handles errors from Axios API calls, normalizing them into ReclaimError instances.
 * Logs the detailed error internally for server-side debugging.
 * This function is typed to return 'never' because it *always* throws an error.
 *
 * @param error - The caught error (could be Axios error, Error, or any other value).
 * @param context - A string providing context for the API call (e.g., function name, parameters).
 * @throws {ReclaimError} Always throws a normalized ReclaimError.
 */
const handleApiError = (error: unknown, context: string): never => {
  let status: number | undefined;
  let detail: unknown;
  let message: string;
  let rawResponse: unknown = null;

  // Log the raw error to help with debugging
  logger.debug(`Raw error in ${context}:`, error);

  if (axios.isAxiosError(error)) {
    // Handle errors from Axios (common with API calls)
    const {
      status: axiosStatus,
      message: axiosMessage,
      detail: axiosDetail,
    } = extractAxiosErrorInfo(error as AxiosError);

    status = axiosStatus;
    message = axiosMessage;
    detail = axiosDetail;

    // Extract the raw response data for detailed debugging
    // This helps us see exactly what the API returned
    rawResponse = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
        params: error.config?.params,
      },
    };

    // Log detailed API response information
    logger.error(`API Error in ${context}: ${message}`, { status, detail, rawResponse });
  } else if (error instanceof Error) {
    const { message: errorMessage, detail: errorDetail } = extractErrorInfo(error);
    message = errorMessage;
    detail = errorDetail;
    logger.error(`Error in ${context}: ${message}`, { name: error.name, stack: error.stack });
  } else {
    // Handle cases where something other than an Error was thrown
    message = "An unexpected error occurred during API call.";
    detail = error; // Preserve the original thrown value
    logger.error(`Unexpected throw during Reclaim API call (${context})`, error);
  }

  // Throw a structured error for consistent handling upstream.
  // Include both context and message for better debugging.
  throw new ReclaimError(`${context}: ${message}`, status, detail, rawResponse);
};

/**
 * Fetches all tasks from the Reclaim API.
 *
 * **Note on `status: "COMPLETE"`:** See the documentation for `filterActiveTasks` for details.
 * This status indicates scheduled time completion, not necessarily user completion.
 *
 * @returns A promise resolving to an array of Task objects.
 * @throws {ReclaimError} If the API request fails.
 */
export async function listTasks(): Promise<Task[]> {
  const context = "listTasks";
  try {
    const { data } = await reclaim.get<Task[]>("/tasks");
    // It's possible the API returns non-array on error, though Axios usually throws. Add check.
    return Array.isArray(data) ? data : [];
  } catch (error) {
    // handleApiError always throws, satisfying the return type Promise<Task[]>
    return handleApiError(error, context);
  }
}

/**
 * Fetches a specific task by its unique ID.
 *
 * **Note on `status: "COMPLETE"`:** See the documentation for `filterActiveTasks` for details.
 * This status indicates scheduled time completion, not necessarily user completion.
 *
 * @param taskId - The numeric ID of the task to fetch.
 * @returns A promise resolving to the requested Task object.
 * @throws {ReclaimError} If the API request fails (e.g., task not found - 404).
 */
export async function getTask(taskId: number): Promise<Task> {
  const context = `getTask(taskId=${taskId})`;
  try {
    const { data } = await reclaim.get<Task>(`/tasks/${taskId}`);
    return data;
  } catch (error) {
    // handleApiError always throws, satisfying the return type Promise<Task>
    return handleApiError(error, context);
  }
}

/**
 * Creates a new task in Reclaim using the provided data.
 * @param taskData - An object containing the properties for the new task. See `TaskInputData`.
 * `title` is typically required by the API. `due` will be generated if `deadline` is omitted.
 * @returns A promise resolving to the newly created Task object as returned by the API.
 * @throws {ReclaimError} If the API request fails (e.g., validation error - 400).
 */
export async function createTask(taskData: TaskInputData): Promise<Task> {
  const context = "createTask";
  try {
    // API expects `due`, not the convenience `deadline` field.
    const apiPayload = normalizeTaskPayload(taskData, true);

    const { data } = await reclaim.post<Task>("/tasks", apiPayload);
    return data;
  } catch (error) {
    // handleApiError always throws, satisfying the return type Promise<Task>
    return handleApiError(error, context);
  }
}

/**
 * Updates an existing task with the specified ID using the provided data.
 * Only the fields included in `taskData` will be updated (PATCH semantics).
 * @param taskId - The numeric ID of the task to update.
 * @param taskData - An object containing the properties to update. See `TaskInputData`.
 * @returns A promise resolving to the updated Task object as returned by the API.
 * @throws {ReclaimError} If the API request fails (e.g., task not found - 404, validation error - 400).
 */
export async function updateTask(taskId: number, taskData: TaskInputData): Promise<Task> {
  const context = `updateTask(taskId=${taskId})`;
  try {
    // API expects `due`, not the convenience `deadline` field.
    const apiPayload = normalizeTaskPayload(taskData, false);

    // Ensure we are actually sending some data to update
    if (Object.keys(apiPayload).length === 0) {
      logger.warn(
        `UpdateTask called for taskId ${taskId} with no fields to update. Skipping API call.`,
      );
      // Fetch and return the current task state as PATCH with no data is a no-op
      return getTask(taskId);
    }

    const { data } = await reclaim.patch<Task>(`/tasks/${taskId}`, apiPayload);
    return data;
  } catch (error) {
    // handleApiError always throws, satisfying the return type Promise<Task>
    return handleApiError(error, context);
  }
}

/**
 * Deletes a task by its unique ID.
 * Note: This is typically a soft delete in Reclaim unless forced otherwise.
 * @param taskId - The numeric ID of the task to delete.
 * @returns A promise resolving to void upon successful deletion (API returns 204 No Content).
 * @throws {ReclaimError} If the API request fails (e.g., task not found - 404).
 */
export async function deleteTask(taskId: number): Promise<void> {
  const context = `deleteTask(taskId=${taskId})`;
  try {
    await reclaim.delete(`/tasks/${taskId}`);
    // Successful deletion returns 204 No Content, promise resolves void implicitly
  } catch (error) {
    // handleApiError always throws. Since the return type is Promise<void>,
    // returning 'never' here also satisfies the compiler.
    return handleApiError(error, context);
  }
}

/**
 * Marks a task as complete in the Reclaim planner (user action).
 * @param taskId - The numeric ID of the task to mark complete.
 * @returns A promise resolving to the API response (often minimal or empty). Use `any` for flexibility or define a specific response type if known.
 * @throws {ReclaimError} If the API request fails.
 */
export async function markTaskComplete(taskId: number): Promise<unknown> {
  const context = `markTaskComplete(taskId=${taskId})`;
  try {
    // Endpoint might return empty body or a confirmation object
    const { data } = await reclaim.post(`/planner/done/task/${taskId}`);
    return data ?? { success: true }; // Provide a default success object if body is empty
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Marks a task as incomplete (e.g., unarchives it).
 * @param taskId - The numeric ID of the task to mark incomplete.
 * @returns A promise resolving to the API response (often minimal or empty). Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails.
 */
export async function markTaskIncomplete(taskId: number): Promise<unknown> {
  const context = `markTaskIncomplete(taskId=${taskId})`;
  try {
    const { data } = await reclaim.post(`/planner/unarchive/task/${taskId}`);
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Adds a specified amount of time to a task's schedule.
 * @param taskId - The numeric ID of the task.
 * @param minutes - The number of minutes to add (must be positive).
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails or minutes is invalid.
 */
export async function addTimeToTask(taskId: number, minutes: number): Promise<unknown> {
  const context = `addTimeToTask(taskId=${taskId}, minutes=${minutes})`;
  if (minutes <= 0) {
    // Throw an error immediately for invalid input, handled by wrapApiCall later
    throw new Error("Minutes must be positive to add time.");
  }
  try {
    // API expects minutes as a query parameter
    const { data } = await reclaim.post(`/planner/add-time/task/${taskId}`, null, {
      params: { minutes },
    });
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Starts the timer for a specific task.
 * @param taskId - The numeric ID of the task to start the timer for.
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails.
 */
export async function startTaskTimer(taskId: number): Promise<unknown> {
  const context = `startTaskTimer(taskId=${taskId})`;
  try {
    const { data } = await reclaim.post(`/planner/start/task/${taskId}`);
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Stops the timer for a specific task.
 * @param taskId - The numeric ID of the task to stop the timer for.
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails.
 */
export async function stopTaskTimer(taskId: number): Promise<unknown> {
  const context = `stopTaskTimer(taskId=${taskId})`;
  try {
    const { data } = await reclaim.post(`/planner/stop/task/${taskId}`);
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Logs work (time spent) against a specific task.
 * @param taskId - The numeric ID of the task to log work against.
 * @param minutes - The number of minutes worked (must be positive).
 * @param end - Optional end time of the work session (ISO 8601 string or YYYY-MM-DD). If omitted, Reclaim usually assumes 'now'.
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails or parameters are invalid.
 */
export async function logWorkForTask(
  taskId: number,
  minutes: number,
  end?: string,
): Promise<unknown> {
  const context = `logWorkForTask(taskId=${taskId}, minutes=${minutes}, end=${end ?? "now"})`;
  if (minutes <= 0) {
    throw new Error("Minutes must be positive to log work.");
  }

  // Prepare query parameters, validating 'end' date if provided
  const params: { minutes: number; end?: string } = { minutes };
  if (end) {
    try {
      // Use parseDeadline to validate and normalize the end date string
      // Reclaim API seems to expect ISO string for 'end' param based on prior JS
      const parsedEnd = parseDeadline(end);
      // Ensure it includes time if only date was given - Reclaim might need time
      if (parsedEnd.length === 10) {
        // YYYY-MM-DD
        params.end = new Date(parsedEnd).toISOString(); // Convert to full ISO string
      } else {
        params.end = parsedEnd;
      }
    } catch (dateError: unknown) {
      // Throw a more specific error if parsing fails
      const message = dateError instanceof Error ? dateError.message : String(dateError);
      throw new Error(
        `Invalid 'end' date format: "${end}". Error: ${message}. Please use ISO 8601 or YYYY-MM-DD format.`,
      );
    }
  }

  try {
    const { data } = await reclaim.post(`/planner/log-work/task/${taskId}`, null, { params });
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Clears any scheduling exceptions associated with a task.
 * @param taskId - The numeric ID of the task.
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails.
 */
export async function clearTaskExceptions(taskId: number): Promise<unknown> {
  const context = `clearTaskExceptions(taskId=${taskId})`;
  try {
    const { data } = await reclaim.post(`/planner/clear-exceptions/task/${taskId}`);
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}

/**
 * Marks a task for prioritization in the Reclaim planner.
 * @param taskId - The numeric ID of the task to prioritize.
 * @returns A promise resolving to the API response. Use `any` for flexibility.
 * @throws {ReclaimError} If the API request fails.
 */
export async function prioritizeTask(taskId: number): Promise<unknown> {
  const context = `prioritizeTask(taskId=${taskId})`;
  try {
    const { data } = await reclaim.post(`/planner/prioritize/task/${taskId}`);
    return data ?? { success: true };
  } catch (error) {
    return handleApiError(error, context);
  }
}
