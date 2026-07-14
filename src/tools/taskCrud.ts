/**
 * @fileoverview Provides handler functions for MCP Tools related to creating and updating Reclaim.ai tasks.
 * These functions are called by the main CallToolRequestSchema handler in index.ts.
 */

import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js"; // Import necessary types with .js extension
import { z } from "zod";
import * as defaultApi from "../reclaim-client.js";
import type { ReclaimApiClient, TaskInputData } from "../types/reclaim.js";
import { wrapApiCall } from "../utils.js";

// --- Zod Schemas for Argument Validation ---
// These should align with the inputSchema in definitions.js but provide runtime validation.

// Reusable complex types for schemas
const deadlineSchemaType = z
  .union([
    z.number().int().positive("Deadline days must be a positive integer."),
    z.string().datetime({ message: "Deadline must be a valid ISO 8601 date/time string." }),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Deadline date must be in YYYY-MM-DD format." }),
  ])
  .optional();

const snoozeUntilSchemaType = z
  .union([
    z.number().int().positive("Snooze days must be a positive integer."),
    z.string().datetime({ message: "Snooze time must be a valid ISO 8601 date/time string." }),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Snooze date must be in YYYY-MM-DD format." }),
  ])
  .optional();

const eventColorSchemaType = z
  .enum([
    "LAVENDER",
    "SAGE",
    "GRAPE",
    "FLAMINGO",
    "BANANA",
    "TANGERINE",
    "PEACOCK",
    "GRAPHITE",
    "BLUEBERRY",
    "BASIL",
    "TOMATO",
  ])
  .optional();

// Schema for Create Task
const createTaskSchema = z.object({
  title: z.string().min(1, "Title cannot be empty."),
  notes: z.string().optional(),
  eventCategory: z.enum(["WORK", "PERSONAL"]).optional(),
  eventSubType: z.string().optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  timeChunksRequired: z
    .number()
    .int()
    .positive("Time chunks must be a positive integer.")
    .optional(),
  onDeck: z.boolean().optional(),
  status: z
    .enum(["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETE", "CANCELLED", "ARCHIVED"])
    .optional(),
  deadline: deadlineSchemaType,
  snoozeUntil: snoozeUntilSchemaType,
  eventColor: eventColorSchemaType,
});
type CreateTaskParams = z.infer<typeof createTaskSchema>;

// Schema for Update Task
const updateTaskSchema = z.object({
  taskId: z.number().int().positive("Task ID must be a positive integer."),
  title: z.string().min(1, "Title cannot be empty.").optional(),
  notes: z.string().optional(),
  eventCategory: z.enum(["WORK", "PERSONAL"]).optional(),
  eventSubType: z.string().optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  timeChunksRequired: z
    .number()
    .int()
    .positive("Time chunks must be a positive integer.")
    .optional(),
  onDeck: z.boolean().optional(),
  status: z
    .enum(["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETE", "CANCELLED", "ARCHIVED"])
    .optional(),
  deadline: deadlineSchemaType,
  snoozeUntil: snoozeUntilSchemaType,
  eventColor: eventColorSchemaType,
});
type UpdateTaskParams = z.infer<typeof updateTaskSchema>;

// Define type for the API client methods needed here
type CrudApiClient = Pick<ReclaimApiClient, "createTask" | "updateTask">;

// --- Exported Handler Functions ---

export async function handleCreateTask(
  params: unknown,
  apiClient: CrudApiClient = defaultApi,
): Promise<CallToolResult> {
  // Add explicit return type promise
  // Validate parameters against the Zod schema
  const validatedParams = createTaskSchema.parse(params) as CreateTaskParams;
  // Pass the validated parameters (already conforming to TaskInputData structure)
  return wrapApiCall(apiClient.createTask(validatedParams as TaskInputData));
}

export async function handleUpdateTask(
  params: unknown,
  apiClient: CrudApiClient = defaultApi,
): Promise<CallToolResult> {
  // Add explicit return type promise
  // Validate parameters against the Zod schema
  const validatedParams = updateTaskSchema.parse(params) as UpdateTaskParams;
  const { taskId, ...updateData } = validatedParams;

  // Ensure there's something to update
  if (Object.keys(updateData).length === 0) {
    // Explicitly construct the return object matching CallToolResult
    const errorContent: TextContent[] = [
      { type: "text", text: "Update requires at least one field to change besides taskId." },
    ];
    const result: CallToolResult = {
      isError: true,
      content: errorContent, // Ensure content matches TextContent[] type
    };
    return result;
  }

  // Pass the validated taskId and updateData (conforming to TaskInputData)
  return wrapApiCall(apiClient.updateTask(taskId, updateData as TaskInputData));
}

// Export schemas if needed elsewhere
export const schemas = {
  createTaskSchema,
  updateTaskSchema,
};
