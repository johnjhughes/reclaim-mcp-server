/**
 * @fileoverview Provides handler functions for MCP Tools related to specific actions on Reclaim.ai tasks
 * (e.g., mark complete, delete, add time, prioritize, list tasks).
 * These functions are called by the main CallToolRequestSchema handler in index.ts.
 */

import { z } from "zod";
import * as defaultApi from "../reclaim-client.js";
import type { ReclaimApiClient } from "../types/reclaim.js"; // Import the full interface
import { wrapApiCall } from "../utils.js";

// --- Common Zod Schemas for Argument Validation ---
// These should align with the inputSchema in definitions.js but provide runtime validation.

const taskIdNumberSchema = z.number().int().positive("Task ID must be a positive integer.");

const listTasksSchema = z.object({
  filter: z
    .enum(["active", "all"])
    .optional()
    .default("active")
    .describe(
      'Filter tasks: "active" (default) excludes ARCHIVED/CANCELLED/deleted; "all" includes all.',
    ),
});
type ListTasksParams = z.infer<typeof listTasksSchema>;

const getTaskSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to fetch."),
});
type GetTaskParams = z.infer<typeof getTaskSchema>;

const markCompleteSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to mark as complete."),
});
type MarkCompleteParams = z.infer<typeof markCompleteSchema>;

const markIncompleteSchema = z.object({
  taskId: taskIdNumberSchema.describe(
    "The unique ID of the task to mark as incomplete (unarchive).",
  ),
});
type MarkIncompleteParams = z.infer<typeof markIncompleteSchema>;

const deleteTaskSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to delete."),
});
type DeleteTaskParams = z.infer<typeof deleteTaskSchema>;

const addTimeSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to add time to."),
  minutes: z
    .number()
    .int()
    .positive("Minutes must be a positive integer.")
    .describe("Number of minutes to add to the task schedule."),
});
type AddTimeParams = z.infer<typeof addTimeSchema>;

const startTimerSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to start the timer for."),
});
type StartTimerParams = z.infer<typeof startTimerSchema>;

const stopTimerSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to stop the timer for."),
});
type StopTimerParams = z.infer<typeof stopTimerSchema>;

const logWorkSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to log work against."),
  minutes: z
    .number()
    .int()
    .positive("Minutes must be a positive integer.")
    .describe("Number of minutes worked."),
  end: z
    .union([
      z.string().datetime({ message: "End time must be a valid ISO 8601 date/time string." }),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "End date must be in YYYY-MM-DD format." }),
    ])
    .optional()
    .describe("Optional end time/date of the work log (ISO 8601 or YYYY-MM-DD). Defaults to now."),
});
type LogWorkParams = z.infer<typeof logWorkSchema>;

const clearExceptionsSchema = z.object({
  taskId: taskIdNumberSchema.describe(
    "The unique ID of the task whose scheduling exceptions should be cleared.",
  ),
});
type ClearExceptionsParams = z.infer<typeof clearExceptionsSchema>;

const prioritizeSchema = z.object({
  taskId: taskIdNumberSchema.describe("The unique ID of the task to prioritize."),
});
type PrioritizeParams = z.infer<typeof prioritizeSchema>;

// --- Common Notes ---
const statusNote =
  "IMPORTANT NOTE ON 'COMPLETE' STATUS: In Reclaim.ai, tasks marked 'COMPLETE' mean their *scheduled time block* finished, but the user did NOT necessarily finish the work or mark it done. Treat 'COMPLETE' tasks as ACTIVE and PENDING unless they are also ARCHIVED or CANCELLED. If asked for 'active' or 'open' tasks, YOU MUST INCLUDE tasks with status 'COMPLETE'.";
const getTimeStatusNote =
  "Note on 'status': If 'COMPLETE', the scheduled time block ended, but the user has NOT marked the task done. It is still considered active/pending.";

// --- Exported Handler Functions ---

export async function handleListTasks(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = listTasksSchema.parse(params) as ListTasksParams;
  const { filter } = validatedParams;
  const allTasksPromise = apiClient.listTasks();
  const processedTasksPromise = allTasksPromise.then((tasks) => {
    if (filter === "active") {
      return apiClient.filterActiveTasks(tasks);
    }
    return tasks;
  });

  const result = await wrapApiCall(processedTasksPromise);
  // Add the status note to the result content if successful
  if (!result.isError && result.content) {
    result.content.push({ type: "text", text: statusNote });
  }
  return result;
}

export async function handleGetTask(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = getTaskSchema.parse(params) as GetTaskParams;
  const { taskId } = validatedParams;
  const result = await wrapApiCall(apiClient.getTask(taskId));
  // Add the status note to the result content if successful
  if (!result.isError && result.content) {
    result.content.push({ type: "text", text: getTimeStatusNote });
  }
  return result;
}

export async function handleMarkComplete(
  params: unknown,
  apiClient: ReclaimApiClient = defaultApi,
) {
  const validatedParams = markCompleteSchema.parse(params) as MarkCompleteParams;
  return wrapApiCall(apiClient.markTaskComplete(validatedParams.taskId));
}

export async function handleMarkIncomplete(
  params: unknown,
  apiClient: ReclaimApiClient = defaultApi,
) {
  const validatedParams = markIncompleteSchema.parse(params) as MarkIncompleteParams;
  return wrapApiCall(apiClient.markTaskIncomplete(validatedParams.taskId));
}

export async function handleDeleteTask(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = deleteTaskSchema.parse(params) as DeleteTaskParams;
  return wrapApiCall(apiClient.deleteTask(validatedParams.taskId));
}

export async function handleAddTime(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = addTimeSchema.parse(params) as AddTimeParams;
  return wrapApiCall(apiClient.addTimeToTask(validatedParams.taskId, validatedParams.minutes));
}

export async function handleStartTimer(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = startTimerSchema.parse(params) as StartTimerParams;
  return wrapApiCall(apiClient.startTaskTimer(validatedParams.taskId));
}

export async function handleStopTimer(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = stopTimerSchema.parse(params) as StopTimerParams;
  return wrapApiCall(apiClient.stopTaskTimer(validatedParams.taskId));
}

export async function handleLogWork(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = logWorkSchema.parse(params) as LogWorkParams;
  return wrapApiCall(
    apiClient.logWorkForTask(validatedParams.taskId, validatedParams.minutes, validatedParams.end),
  );
}

export async function handleClearExceptions(
  params: unknown,
  apiClient: ReclaimApiClient = defaultApi,
) {
  const validatedParams = clearExceptionsSchema.parse(params) as ClearExceptionsParams;
  return wrapApiCall(apiClient.clearTaskExceptions(validatedParams.taskId));
}

export async function handlePrioritize(params: unknown, apiClient: ReclaimApiClient = defaultApi) {
  const validatedParams = prioritizeSchema.parse(params) as PrioritizeParams;
  return wrapApiCall(apiClient.prioritizeTask(validatedParams.taskId));
}

// Export schemas if needed elsewhere, though primarily used internally here now
export const schemas = {
  listTasksSchema,
  getTaskSchema,
  markCompleteSchema,
  markIncompleteSchema,
  deleteTaskSchema,
  addTimeSchema,
  startTimerSchema,
  stopTimerSchema,
  logWorkSchema,
  clearExceptionsSchema,
  prioritizeSchema,
};
