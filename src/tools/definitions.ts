/**
 * @fileoverview Defines tool definitions in the format required by the MCP specification
 * for the ListToolsRequestSchema handler.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Tool definitions array, now strongly typed
export const toolDefinitions = [
  {
    name: "reclaim_list_tasks",
    description:
      "Lists Reclaim.ai tasks. Default filter is 'active'. IMPORTANT NOTE ON 'COMPLETE' STATUS: In Reclaim.ai, tasks marked 'COMPLETE' mean their *scheduled time block* finished, but the user did NOT necessarily finish the work or mark it done. Treat 'COMPLETE' tasks as ACTIVE and PENDING unless they are also ARCHIVED or CANCELLED. If asked for 'active' or 'open' tasks, YOU MUST INCLUDE tasks with status 'COMPLETE'.",
    inputSchema: {
      type: "object",
      description:
        "Lists Reclaim.ai tasks. Default filter is 'active'. IMPORTANT NOTE ON 'COMPLETE' STATUS: In Reclaim.ai, tasks marked 'COMPLETE' mean their *scheduled time block* finished, but the user did NOT necessarily finish the work or mark it done. Treat 'COMPLETE' tasks as ACTIVE and PENDING unless they are also ARCHIVED or CANCELLED. If asked for 'active' or 'open' tasks, YOU MUST INCLUDE tasks with status 'COMPLETE'.",
      properties: {
        filter: {
          type: "string",
          enum: ["active", "all"],
          default: "active", // Add default here for schema clarity
          description:
            'Filter tasks: "active" (default) excludes ARCHIVED/CANCELLED/deleted; "all" includes all.',
        },
      },
      required: [], // No required properties
    },
    annotations: {
      // Add annotations
      readOnlyHint: true,
      idempotentHint: true, // Listing tasks is idempotent
    },
  },
  {
    name: "reclaim_get_task",
    description:
      "Retrieves details for a specific Reclaim.ai task by its ID. Note on 'status': If 'COMPLETE', the scheduled time block ended, but the user has NOT marked the task done. It is still considered active/pending.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The unique ID of the task to fetch.",
        },
      },
      required: ["taskId"],
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
  {
    name: "reclaim_create_task",
    description:
      "Create a new task in Reclaim.ai. Requires at least a 'title'. Other fields like 'timeChunksRequired', 'priority', 'deadline', 'notes', 'eventCategory' are optional but recommended.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The title of the task.", minLength: 1 },
        notes: { type: "string", description: "Optional notes about the task." },
        eventCategory: {
          type: "string",
          enum: ["WORK", "PERSONAL"],
          description: "Category of the task.",
        },
        eventSubType: { type: "string", description: "Subcategory of the task." },
        priority: {
          type: "string",
          enum: ["P1", "P2", "P3", "P4"],
          description: "Priority level of the task.",
        },
        timeChunksRequired: {
          type: "integer",
          description: "Number of 15-minute chunks required.",
          minimum: 1,
        },
        onDeck: { type: "boolean", description: "Whether to prioritize this task." },
        status: {
          type: "string",
          enum: ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETE", "CANCELLED", "ARCHIVED"],
          description: "Status of the task.",
        },
        deadline: {
          oneOf: [
            {
              type: "integer",
              minimum: 1,
              description: "Number of days from now for the deadline.",
            },
            { type: "string", format: "date-time", description: "ISO 8601 date/time string." },
            {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "YYYY-MM-DD date format.",
            },
          ],
          description: "Deadline: days from now, ISO string, or YYYY-MM-DD.",
        },
        snoozeUntil: {
          oneOf: [
            {
              type: "integer",
              minimum: 1,
              description: "Number of days from now to snooze until.",
            },
            { type: "string", format: "date-time", description: "ISO 8601 date/time string." },
            {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "YYYY-MM-DD date format.",
            },
          ],
          description: "Snooze until: days from now, ISO string, or YYYY-MM-DD.",
        },
        eventColor: {
          type: "string",
          enum: [
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
          ],
          description: "Color of the task in the calendar.",
        },
      },
      required: ["title"],
    },
    annotations: {
      // Not idempotent because creating the same task twice results in two tasks
      // Not read-only because it creates data
    },
  },
  {
    name: "reclaim_update_task",
    description:
      "Update specific fields of an existing Reclaim.ai task using its ID. This performs a PATCH operation – only provided fields are changed.\nIMPORTANT: Updating fields like 'notes' overwrites the existing content. To *append* to notes, you MUST first use 'reclaim_get_task' to fetch the current notes, then provide the full combined text (old + new) in the 'notes' field of this update call.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to update." },
        // Make other properties optional for update
        title: { type: "string", description: "The new title of the task.", minLength: 1 },
        notes: { type: "string", description: "New notes about the task (overwrites existing)." },
        eventCategory: { type: "string", enum: ["WORK", "PERSONAL"], description: "New category." },
        eventSubType: { type: "string", description: "New subcategory." },
        priority: {
          type: "string",
          enum: ["P1", "P2", "P3", "P4"],
          description: "New priority level.",
        },
        timeChunksRequired: {
          type: "integer",
          description: "New number of 15-minute chunks.",
          minimum: 1,
        },
        onDeck: { type: "boolean", description: "New prioritization status." },
        status: {
          type: "string",
          enum: ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETE", "CANCELLED", "ARCHIVED"],
          description: "New status.",
        },
        deadline: {
          oneOf: [
            {
              type: "integer",
              minimum: 1,
              description: "Number of days from now for the deadline.",
            },
            { type: "string", format: "date-time", description: "ISO 8601 date/time string." },
            {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "YYYY-MM-DD date format.",
            },
          ],
          description: "New deadline: days from now, ISO string, or YYYY-MM-DD.",
        },
        snoozeUntil: {
          oneOf: [
            {
              type: "integer",
              minimum: 1,
              description: "Number of days from now to snooze until.",
            },
            { type: "string", format: "date-time", description: "ISO 8601 date/time string." },
            {
              type: "string",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              description: "YYYY-MM-DD date format.",
            },
          ],
          description: "New snooze until: days from now, ISO string, or YYYY-MM-DD.",
        },
        eventColor: {
          type: "string",
          enum: [
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
          ],
          description: "New color for the task.",
        },
      },
      required: ["taskId"], // Only taskId is required, others are optional updates
      minProperties: 2, // Require taskId + at least one field to update
    },
    annotations: {
      // Technically idempotent if the update object is identical on subsequent calls,
      // but often used non-idempotently (e.g., changing status multiple times).
      // Mark as idempotent: false to be safe.
      idempotentHint: false,
    },
  },
  {
    name: "reclaim_mark_complete",
    description:
      "Marks a specific Reclaim.ai task as completed/done by the user. This usually archives the task.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to mark as complete." },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Marking complete multiple times has no further effect
    },
  },
  {
    name: "reclaim_mark_incomplete",
    description:
      "Marks a specific Reclaim.ai task as incomplete (e.g., unarchives it, moves it back to the planner).",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The unique ID of the task to mark as incomplete (unarchive).",
        },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Marking incomplete multiple times has no further effect
    },
  },
  {
    name: "reclaim_delete_task",
    description:
      "Permanently delete a specific Reclaim.ai task. This action cannot be undone easily.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to delete." },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Deleting multiple times has no further effect after the first
      destructiveHint: true, // This is a destructive action
    },
  },
  {
    name: "reclaim_add_time",
    description:
      "Adds scheduled time (in minutes) to a specific Reclaim.ai task. This blocks more time on the user's calendar. Use this if a task needs more time than allocated (e.g., timeChunksRemaining is 0 but work remains) or if a task has status 'COMPLETE' but the user indicates it's not finished.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to add time to." },
        minutes: { type: "integer", description: "Number of minutes to add.", minimum: 1 },
      },
      required: ["taskId", "minutes"],
    },
    annotations: {
      // Not idempotent as adding time multiple times increases total time
    },
  },
  {
    name: "reclaim_start_timer",
    description:
      "Starts the live timer for a specific Reclaim.ai task. This indicates the user is actively working on it now and helps log time accurately.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The unique ID of the task to start the timer for.",
        },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Starting an already started timer likely has no effect
    },
  },
  {
    name: "reclaim_stop_timer",
    description:
      "Stops the live timer for a specific Reclaim.ai task. Time tracked is automatically logged.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The unique ID of the task to stop the timer for.",
        },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Stopping an already stopped timer likely has no effect
    },
  },
  {
    name: "reclaim_log_work",
    description:
      "Logs completed work time (in minutes) against a specific Reclaim.ai task. This reduces the remaining time needed and affects future scheduling.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to log work against." },
        minutes: { type: "integer", description: "Number of minutes worked.", minimum: 1 },
        end: {
          type: "string",
          description: "Optional end time/date (ISO 8601 or YYYY-MM-DD). Defaults to now.",
          oneOf: [
            // More specific typing for end date
            { format: "date-time" },
            { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          ],
        },
      },
      required: ["taskId", "minutes"],
    },
    annotations: {
      // Not idempotent as logging work multiple times increases total logged time
    },
  },
  {
    name: "reclaim_clear_exceptions",
    description:
      "Clears any scheduling exceptions (e.g., manual adjustments, declines) for a specific Reclaim.ai task, allowing it to reschedule normally.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: {
          type: "integer",
          description: "The unique ID of the task whose exceptions should be cleared.",
        },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Clearing exceptions multiple times has no further effect
    },
  },
  {
    name: "reclaim_prioritize",
    description:
      "Marks a specific Reclaim.ai task for prioritization ('On Deck'), increasing its likelihood of being scheduled sooner.",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "integer", description: "The unique ID of the task to prioritize." },
      },
      required: ["taskId"],
    },
    annotations: {
      idempotentHint: true, // Prioritizing multiple times has no further effect
    },
  },
] satisfies Tool[];
