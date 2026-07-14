/**
 * @fileoverview Shared TypeScript types for Reclaim.ai API interactions.
 */

// Based on observed API usage and prior JS implementation details.
// Refine these based on actual API responses or Swagger/OpenAPI specs if available.

export interface Task {
  id: number;
  title: string;
  notes?: string;
  eventCategory?: "WORK" | "PERSONAL";
  eventSubType?: string; // e.g., "FOCUS", "MEETING"
  priority?: "P1" | "P2" | "P3" | "P4";
  timeChunksRequired?: number; // In 15-min increments
  timeChunksSpent?: number;
  timeChunksRemaining?: number;
  minChunkSize?: number; // In 15-min increments
  maxChunkSize?: number; // In 15-min increments
  /**
   * Task status in Reclaim.ai.
   * **Important:** `COMPLETE` status means the task has finished its *scheduled time allocation*,
   * but the user may *not* have marked the task as actually done. Such tasks are still
   * considered "active" for filtering purposes unless `ARCHIVED`, `CANCELLED`, or `deleted`.
   */
  status?: "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "CANCELLED" | "ARCHIVED";
  due?: string; // ISO 8601 format (e.g., "2025-04-22T03:44:52.081Z")
  snoozeUntil?: string; // ISO 8601 format
  eventColor?: string; // e.g., 'GRAPE', 'LAVENDER', 'GRAPHITE'
  deleted?: boolean;
  onDeck?: boolean; // User wants to prioritize this next
  created?: string; // ISO 8601 format
  updated?: string; // ISO 8601 format
  finished?: string; // ISO 8601 format - Time the task was marked complete or time ran out? Check API docs.
  adjusted?: boolean; // Was the schedule adjusted?
  atRisk?: boolean; // Is the deadline at risk?
  timeSchemeId?: string; // UUID linking to time scheduling rules
  index?: number; // Internal sorting index?
  alwaysPrivate?: boolean; // Should event always be private on calendar?
  sortKey?: number; // Internal sorting key?
  taskSource?: { type: string; [key: string]: unknown }; // Origin (e.g., RECLAIM_APP, GOOGLE_CALENDAR)
  readOnlyFields?: string[]; // Fields that cannot be modified
  type?: "TASK" | "HABIT"; // Type of item
  recurringAssignmentType?: string; // How recurrence is handled
  // Allow for additional properties not explicitly defined, as API might add fields
  [key: string]: unknown;
}

export interface TaskInputData {
  title?: string; // Required for create, optional for update
  notes?: string;
  eventCategory?: "WORK" | "PERSONAL";
  eventSubType?: string;
  priority?: "P1" | "P2" | "P3" | "P4";
  timeChunksRequired?: number; // 1 chunk = 15 mins
  onDeck?: boolean;
  /**
   * Task status. See `Task` interface for notes on the `COMPLETE` status meaning.
   */
  status?: "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETE" | "CANCELLED" | "ARCHIVED";
  /** Deadline for the task. Handled by `parseDeadline` in API client. Can be number (days from now) or ISO/YYYY-MM-DD string. */
  deadline?: number | string;
  /** Date until task is snoozed. Handled by `parseDeadline` in API client. Can be number (days from now) or ISO/YYYY-MM-DD string. */
  snoozeUntil?: number | string;
  eventColor?: string; // e.g., "LAVENDER", "SAGE", ...
  /** Used internally by API client, represents the ISO string for the deadline. Do not set directly if using `deadline`. */
  due?: string;
  // Other potential fields for create/update - check API if needed
  // minChunkSize?: number;
  // maxChunkSize?: number;
}

/**
 * Custom error class for Reclaim API specific errors.
 * Includes optional status code and detailed error response.
 */
export class ReclaimError extends Error {
  status?: number;
  detail?: unknown;
  rawResponse?: unknown;

  constructor(message: string, status?: number, detail?: unknown, rawResponse?: unknown) {
    super(message);
    this.name = "ReclaimError";
    if (status !== undefined) {
      this.status = status;
    }
    this.detail = detail;
    this.rawResponse = rawResponse;

    // Maintains proper stack trace in V8 environments (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ReclaimError);
    }
  }
}

/**
 * Interface for all Reclaim API client methods
 * This allows for dependency injection and mocking in tests
 */
export interface ReclaimApiClient {
  // Task retrieval methods
  listTasks(): Promise<Task[]>;
  getTask(taskId: number): Promise<Task>;
  filterActiveTasks(tasks: Task[]): Task[];

  // Task CRUD operations
  createTask(taskData: TaskInputData): Promise<Task>;
  updateTask(taskId: number, taskData: TaskInputData): Promise<Task>;
  deleteTask(taskId: number): Promise<void>;

  // Task status operations
  markTaskComplete(taskId: number): Promise<unknown>;
  markTaskIncomplete(taskId: number): Promise<unknown>;

  // Task time management
  addTimeToTask(taskId: number, minutes: number): Promise<unknown>;
  logWorkForTask(taskId: number, minutes: number, end?: string): Promise<unknown>;

  // Task scheduling operations
  startTaskTimer(taskId: number): Promise<unknown>;
  stopTaskTimer(taskId: number): Promise<unknown>;
  prioritizeTask(taskId: number): Promise<unknown>;
  clearTaskExceptions(taskId: number): Promise<unknown>;

  // Helper methods
  parseDeadline(deadlineInput: number | string | undefined): string;
}
