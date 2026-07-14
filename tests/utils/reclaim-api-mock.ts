/**
 * @fileoverview Mock implementation of the Reclaim.ai API client for testing
 * Allows intercepting and mocking API calls without hitting the real API
 */

import { filterActiveTasks } from "../../src/reclaim-client.js";
import {
  type ReclaimApiClient,
  ReclaimError,
  type Task,
  type TaskInputData,
} from "../../src/types/reclaim.js";
import { testLogger } from "./logger.js";

// Sample task data to use in tests
export const sampleTasks: Task[] = [
  {
    id: 12345,
    title: "Sample Task 1",
    notes: "This is a sample task for testing",
    status: "NEW",
    eventCategory: "WORK",
    priority: "P2",
    timeChunksRequired: 4,
    timeChunksSpent: 0,
    timeChunksRemaining: 4,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
  {
    id: 67890,
    title: "Sample Task 2",
    notes: "This is another sample task",
    status: "IN_PROGRESS",
    eventCategory: "PERSONAL",
    priority: "P1",
    timeChunksRequired: 8,
    timeChunksSpent: 2,
    timeChunksRemaining: 6,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
  {
    id: 54321,
    title: "Sample Task 3",
    notes: "This is a deleted task",
    status: "NEW",
    deleted: true,
    eventCategory: "WORK",
    priority: "P3",
    timeChunksRequired: 2,
    timeChunksSpent: 0,
    timeChunksRemaining: 2,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
  {
    id: 98765,
    title: "Sample Task 4",
    notes: "This is a completed task",
    status: "ARCHIVED",
    eventCategory: "WORK",
    priority: "P3",
    timeChunksRequired: 2,
    timeChunksSpent: 2,
    timeChunksRemaining: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    finished: new Date().toISOString(),
  },
  {
    id: 24680,
    title: "Sample Task 5",
    notes: "This is a task with scheduled time finished",
    status: "COMPLETE",
    eventCategory: "PERSONAL",
    priority: "P4",
    timeChunksRequired: 6,
    timeChunksSpent: 6,
    timeChunksRemaining: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  },
];

/**
 * Creates a mock implementation of the Reclaim.ai API client for testing.
 * Stores task data in memory and simulates API behavior.
 */
export function createReclaimApiMock(): ReclaimApiClient {
  // Clone the sample tasks to start with
  const tasks: Task[] = JSON.parse(JSON.stringify(sampleTasks));
  let nextTaskId = 100000;

  // Tracking for mock calls
  const calls: {
    method: string;
    args: unknown[];
    timestamp: string;
  }[] = [];

  // Helper to record a method call
  const recordCall = (method: string, args: unknown[]) => {
    calls.push({
      method,
      args,
      timestamp: new Date().toISOString(),
    });
    testLogger.debug(`Mock API Call: ${method}`, args);
  };

  // Task helpers
  const findTaskById = (taskId: number): Task | undefined => {
    return tasks.find((task) => task.id === taskId);
  };

  const createTaskId = (): number => {
    return nextTaskId++;
  };

  // Method implementations
  const listTasks = async (): Promise<Task[]> => {
    recordCall("listTasks", []);
    // Return a deep copy to prevent mutation of the mock state
    return JSON.parse(JSON.stringify(tasks));
  };

  const getTask = async (taskId: number): Promise<Task> => {
    recordCall("getTask", [taskId]);

    const task = findTaskById(taskId);
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Return a deep copy to prevent mutation of the mock state
    return JSON.parse(JSON.stringify(task));
  };

  const createTask = async (taskData: TaskInputData): Promise<Task> => {
    recordCall("createTask", [taskData]);

    const taskId = createTaskId();
    const createdTime = new Date().toISOString();

    // Create a task object that conforms to the Task interface
    // Start with a minimal valid task structure
    const baseTask = {
      id: taskId,
      title: taskData.title || "Untitled Task",
      timeChunksSpent: 0,
      timeChunksRemaining: taskData.timeChunksRequired ?? 0,
      status: taskData.status || "NEW",
      created: createdTime,
      updated: createdTime,
      type: "TASK" as const,
    };

    // Add optional fields only if they have values (don't set undefined explicitly)
    const newTask: Task = baseTask;

    if (taskData.notes) newTask.notes = taskData.notes;
    if (taskData.eventCategory) newTask.eventCategory = taskData.eventCategory;
    if (taskData.eventSubType) newTask.eventSubType = taskData.eventSubType;
    if (taskData.priority) newTask.priority = taskData.priority;
    if (taskData.timeChunksRequired !== undefined)
      newTask.timeChunksRequired = taskData.timeChunksRequired;
    if (taskData.onDeck !== undefined) newTask.onDeck = taskData.onDeck;
    if (taskData.eventColor) newTask.eventColor = taskData.eventColor;
    if (taskData.due) newTask.due = taskData.due;
    if (typeof taskData.snoozeUntil === "string") newTask.snoozeUntil = taskData.snoozeUntil;

    tasks.push(newTask);

    // Return a deep copy to prevent mutation of the mock state
    return JSON.parse(JSON.stringify(newTask));
  };

  const updateTask = async (taskId: number, taskData: TaskInputData): Promise<Task> => {
    recordCall("updateTask", [taskId, taskData]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Update task fields
    const updatedTask = {
      ...tasks[taskIndex],
      ...taskData,
      updated: new Date().toISOString(),
    };

    // Recalculate remaining time if required changes
    if (taskData.timeChunksRequired !== undefined) {
      updatedTask.timeChunksRemaining =
        taskData.timeChunksRequired - (updatedTask.timeChunksSpent || 0);
    }

    // Ensure id is preserved when updating task
    // Make sure we have all required fields for a valid Task
    const existingTask = tasks[taskIndex];
    if (!existingTask) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Create a clean task object with proper types
    const cleanTask = {
      ...existingTask, // Start with the existing task to ensure we have all required fields
      id: taskId, // Ensure ID is preserved
      title: updatedTask.title || existingTask.title, // Title is required
      type: updatedTask.type || existingTask.type || "TASK", // Type is required
      updated: new Date().toISOString(), // Update the timestamp
    };

    // Copy properties from updatedTask, ensuring type compatibility
    if (updatedTask.notes !== undefined) cleanTask.notes = updatedTask.notes;
    if (updatedTask.eventCategory !== undefined)
      cleanTask.eventCategory = updatedTask.eventCategory;
    if (updatedTask.eventSubType !== undefined) cleanTask.eventSubType = updatedTask.eventSubType;
    if (updatedTask.priority !== undefined) cleanTask.priority = updatedTask.priority;
    if (updatedTask.timeChunksRequired !== undefined)
      cleanTask.timeChunksRequired = updatedTask.timeChunksRequired;
    if (updatedTask.timeChunksSpent !== undefined)
      cleanTask.timeChunksSpent = updatedTask.timeChunksSpent;
    if (updatedTask.timeChunksRemaining !== undefined)
      cleanTask.timeChunksRemaining = updatedTask.timeChunksRemaining;
    if (updatedTask.status !== undefined) cleanTask.status = updatedTask.status;
    if (updatedTask.onDeck !== undefined) cleanTask.onDeck = updatedTask.onDeck;
    if (updatedTask.eventColor !== undefined) cleanTask.eventColor = updatedTask.eventColor;
    if (updatedTask.due !== undefined) cleanTask.due = updatedTask.due;

    // Handle snoozeUntil specially to ensure it's always a string if provided
    if (updatedTask.snoozeUntil !== undefined) {
      if (typeof updatedTask.snoozeUntil === "string") {
        cleanTask.snoozeUntil = updatedTask.snoozeUntil;
      } else if (updatedTask.snoozeUntil !== null) {
        // Convert to string if it's a number or other non-null value
        cleanTask.snoozeUntil = parseDeadline(updatedTask.snoozeUntil);
      }
    }

    // Update the task in the array
    tasks[taskIndex] = cleanTask;

    // Return a deep copy to prevent mutation of the mock state
    return JSON.parse(JSON.stringify(cleanTask));
  };

  const deleteTask = async (taskId: number): Promise<void> => {
    recordCall("deleteTask", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Remove the task
    tasks.splice(taskIndex, 1);
  };

  const markTaskComplete = async (taskId: number): Promise<unknown> => {
    recordCall("markTaskComplete", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Safe access to potentially undefined task
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Update task status to ARCHIVED (completed)
    tasks[taskIndex] = {
      ...task,
      id: taskId, // Ensure ID is preserved
      status: "ARCHIVED",
      finished: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    return { success: true };
  };

  const markTaskIncomplete = async (taskId: number): Promise<unknown> => {
    recordCall("markTaskIncomplete", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Safe access to potentially undefined task
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Update task status to IN_PROGRESS
    tasks[taskIndex] = {
      ...task,
      id: taskId, // Ensure ID is preserved
      status: "IN_PROGRESS",
      // For TypeScript exactOptionalPropertyTypes compatibility, we need to delete 'finished'
      // rather than setting it to undefined
      updated: new Date().toISOString(),
    };

    // Remove the finished property completely instead of setting to undefined
    if ("finished" in tasks[taskIndex]) {
      const taskCopy = { ...tasks[taskIndex] };
      delete taskCopy.finished;
      tasks[taskIndex] = taskCopy;
    }

    return { success: true };
  };

  const addTimeToTask = async (taskId: number, minutes: number): Promise<unknown> => {
    recordCall("addTimeToTask", [taskId, minutes]);

    if (minutes <= 0) {
      throw new Error("Minutes must be positive to add time.");
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Convert minutes to chunks (1 chunk = 30 min)
    const chunks = Math.ceil(minutes / 30);

    // Update task time chunks
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    const currentChunks = task.timeChunksRequired || 0;
    task.timeChunksRequired = currentChunks + chunks;
    task.timeChunksRemaining = (task.timeChunksRemaining || 0) + chunks;
    task.updated = new Date().toISOString();

    // Make sure we use the task variable we validated earlier
    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  const startTaskTimer = async (taskId: number): Promise<unknown> => {
    recordCall("startTaskTimer", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Update task status to IN_PROGRESS
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    task.status = "IN_PROGRESS";
    task.updated = new Date().toISOString();

    // Make sure we use the task variable we validated earlier
    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  const stopTaskTimer = async (taskId: number): Promise<unknown> => {
    recordCall("stopTaskTimer", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Get the task and validate it exists
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  const logWorkForTask = async (
    taskId: number,
    minutes: number,
    end?: string,
  ): Promise<unknown> => {
    recordCall("logWorkForTask", [taskId, minutes, end]);

    if (minutes <= 0) {
      throw new Error("Minutes must be positive to log work.");
    }

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Convert minutes to chunks (1 chunk = 30 min)
    const chunks = Math.ceil(minutes / 30);

    // Update task time chunks
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    task.timeChunksSpent = (task.timeChunksSpent || 0) + chunks;
    task.timeChunksRemaining = Math.max(
      0,
      (task.timeChunksRequired || 0) - (task.timeChunksSpent || 0),
    );
    task.updated = new Date().toISOString();

    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  const clearTaskExceptions = async (taskId: number): Promise<unknown> => {
    recordCall("clearTaskExceptions", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Safe access to potentially undefined task
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    task.updated = new Date().toISOString();

    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  const prioritizeTask = async (taskId: number): Promise<unknown> => {
    recordCall("prioritizeTask", [taskId]);

    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex === -1) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    // Safe access to potentially undefined task
    const task = tasks[taskIndex];
    if (!task) {
      throw new ReclaimError(`Task with ID ${taskId} not found`, 404, {
        errorCode: "TASK_NOT_FOUND",
      });
    }

    task.status = "SCHEDULED";
    task.updated = new Date().toISOString();

    return {
      events: [],
      taskOrHabit: JSON.parse(JSON.stringify(task)),
    };
  };

  // Export the API methods and utility functions for testing
  // Create a function to parse deadline input (required by ReclaimApiClient interface)
  // Ensures we return a string for deadline, handling various input types
  // For type safety, we only return string type for snoozeUntil and due dates
  const parseDeadline = (deadlineInput: number | string | Date | undefined): string => {
    if (deadlineInput instanceof Date) {
      return deadlineInput.toISOString();
    }
    if (typeof deadlineInput === "number") {
      const now = new Date();
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + deadlineInput);
      return deadline.toISOString();
    }
    if (typeof deadlineInput === "string") {
      return new Date(deadlineInput).toISOString();
    }
    // Default to 24 hours
    const defaultDeadline = new Date();
    defaultDeadline.setHours(defaultDeadline.getHours() + 24);
    return defaultDeadline.toISOString();
  };

  // Return only the API methods for the ReclaimApiClient interface
  const apiClient: ReclaimApiClient = {
    listTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    markTaskComplete,
    markTaskIncomplete,
    addTimeToTask,
    startTaskTimer,
    stopTaskTimer,
    logWorkForTask,
    clearTaskExceptions,
    prioritizeTask,
    filterActiveTasks,
    parseDeadline,
  };

  // Return the API client with test utilities as additional properties
  return Object.assign(apiClient, {
    // Testing utilities
    reset: () => {
      tasks.length = 0;
      tasks.push(...JSON.parse(JSON.stringify(sampleTasks)));
      calls.length = 0;
      nextTaskId = 100000;
    },

    addTask: (task: Task) => {
      tasks.push(JSON.parse(JSON.stringify(task)));
    },

    getCalls: (method?: string) => {
      if (method) {
        return calls.filter((call) => call.method === method);
      }
      return [...calls];
    },

    clearCalls: () => {
      calls.length = 0;
    },

    // For test access
    mockTasks: tasks,
    mockCalls: calls,
  }) as ReclaimApiClient & {
    reset: () => void;
    addTask: (task: Task) => void;
    getCalls: (method?: string) => typeof calls;
    clearCalls: () => void;
    mockTasks: typeof tasks;
    mockCalls: typeof calls;
  };
}
