/**
 * @fileoverview Integration test for the complete task lifecycle
 * Tests all Reclaim.ai tools in a logical sequence mimicking real usage
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as api from "../../src/reclaim-client.js";
import type { Task } from "../../src/types/reclaim.js";
import { testLogger } from "../utils/logger.js";
import {
  cleanupTestTasks,
  delay,
  generateTaskTitle,
  verifyTaskChanges,
} from "../utils/testUtils.js";

// Test constants
const TEST_NAME = "TaskLifecycle";
const describeLive = process.env.RECLAIM_LIVE_TESTS === "1" ? describe : describe.skip;

describeLive("Reclaim Task Lifecycle", () => {
  // Track the task ID and state for the current test
  let testTaskId: number;
  let taskBeforeOp: Task;

  // Ensure test environment is configured correctly
  beforeAll(async () => {
    // Verify API key is set
    if (!process.env.RECLAIM_API_KEY) {
      throw new Error(
        "RECLAIM_API_KEY environment variable is not set. Required for integration tests.",
      );
    }

    testLogger.suiteStart(TEST_NAME);

    // Clean up any leftover test tasks
    await cleanupTestTasks(TEST_NAME);
  });

  afterAll(async () => {
    // Try to delete our test task if it exists
    if (testTaskId) {
      try {
        await api.deleteTask(testTaskId);
        testLogger.step(TEST_NAME, `Deleted test task: ${testTaskId}`);
      } catch {
        // Task may already be deleted, that's fine
      }
    }

    // Final cleanup to ensure we don't leave anything behind
    await cleanupTestTasks(TEST_NAME);

    testLogger.suiteEnd(TEST_NAME, 1, 0);
  });

  it("should execute the complete task lifecycle", async () => {
    // This is one large test to maintain the task lifecycle flow
    // Each step is clearly logged for diagnostic purposes

    // Step 1: List tasks to verify API connectivity
    testLogger.step(TEST_NAME, "STEP 1: List existing tasks");
    const initialTasks = await api.listTasks();
    testLogger.step(TEST_NAME, `Found ${initialTasks.length} tasks initially`);
    expect(Array.isArray(initialTasks)).toBe(true);

    // Step 2: Create a test task
    testLogger.step(TEST_NAME, "STEP 2: Create a test task");
    const taskTitle = generateTaskTitle(TEST_NAME);

    const newTask = await api.createTask({
      title: taskTitle,
      notes: "Integration test task",
      priority: "P3",
      eventCategory: "WORK",
      timeChunksRequired: 2, // 1 hour (2 x 30-min chunks)
    });

    testTaskId = newTask.id;
    testLogger.step(TEST_NAME, `Created task with ID: ${testTaskId}`);

    expect(newTask.id).toBeGreaterThan(0);
    expect(newTask.title).toBe(taskTitle);
    expect(newTask.notes).toBe("Integration test task");
    expect(newTask.priority).toBe("P3");
    expect(newTask.timeChunksRequired).toBe(2);

    // Step 3: Get the task to verify it exists
    testLogger.step(TEST_NAME, "STEP 3: Verify task exists with getTask");
    const retrievedTask = await api.getTask(testTaskId);

    expect(retrievedTask.id).toBe(testTaskId);
    expect(retrievedTask.title).toBe(taskTitle);

    // Step 4: Update the task
    testLogger.step(TEST_NAME, "STEP 4: Update the task");
    const updatedTitle = `${taskTitle} (Updated)`;

    // Store current state before update
    taskBeforeOp = retrievedTask;

    const updatedTask = await api.updateTask(testTaskId, {
      title: updatedTitle,
      notes: "Updated notes",
      priority: "P2",
    });

    // Verify changes
    expect(
      verifyTaskChanges(TEST_NAME, taskBeforeOp, updatedTask, {
        title: updatedTitle,
        notes: "Updated notes",
        priority: "P2",
      }),
    ).toBe(true);

    // Step 5: Add time to the task
    testLogger.step(TEST_NAME, "STEP 5: Add time to the task");

    // Store current state before operation
    taskBeforeOp = updatedTask;

    const addTimeMinutes = 60; // 2 chunks
    await api.addTimeToTask(testTaskId, addTimeMinutes);

    // Get updated task to verify changes
    const taskAfterAddTime = await api.getTask(testTaskId);

    // We expect timeChunksRequired to increase by 2 chunks (60 min)
    const priorChunks = taskBeforeOp.timeChunksRequired;
    if (priorChunks === undefined) {
      throw new Error("Updated task did not include timeChunksRequired");
    }
    const expectedChunks = priorChunks + 2;
    expect(
      verifyTaskChanges(TEST_NAME, taskBeforeOp, taskAfterAddTime, {
        timeChunksRequired: expectedChunks,
      }),
    ).toBe(true);

    // Step 6: Prioritize the task
    testLogger.step(TEST_NAME, "STEP 6: Prioritize the task");

    // Store current state before operation
    taskBeforeOp = taskAfterAddTime;

    await api.prioritizeTask(testTaskId);

    // Get updated task to verify changes
    const taskAfterPrioritize = await api.getTask(testTaskId);

    // Prioritizing typically sets the status to SCHEDULED
    expect(taskAfterPrioritize.status).toBe("SCHEDULED");

    // Step 7: Start the timer
    testLogger.step(TEST_NAME, "STEP 7: Start the timer");

    // Store current state before operation
    taskBeforeOp = taskAfterPrioritize;

    await api.startTaskTimer(testTaskId);

    // Get updated task to verify changes
    const taskAfterStartTimer = await api.getTask(testTaskId);

    // Starting timer should set status to IN_PROGRESS
    expect(taskAfterStartTimer.status).toBe("IN_PROGRESS");

    // Brief delay to simulate work
    await delay(2000);

    // Step 8: Stop the timer
    testLogger.step(TEST_NAME, "STEP 8: Stop the timer");

    // Store current state before operation
    taskBeforeOp = taskAfterStartTimer;

    await api.stopTaskTimer(testTaskId);

    // Get updated task to verify changes
    const taskAfterStopTimer = await api.getTask(testTaskId);

    // Stopping timer should change status from IN_PROGRESS
    expect(taskAfterStopTimer.status).not.toBe("IN_PROGRESS");

    // Step 9: Log work for the task
    testLogger.step(TEST_NAME, "STEP 9: Log work for the task");

    // Store current state before operation
    taskBeforeOp = taskAfterStopTimer;

    const logWorkMinutes = 30; // 1 chunk
    await api.logWorkForTask(testTaskId, logWorkMinutes);

    // Get updated task to verify changes
    const taskAfterLogWork = await api.getTask(testTaskId);

    // Logging work increases timeChunksSpent
    expect(taskAfterLogWork.timeChunksSpent).toBeGreaterThan(taskBeforeOp.timeChunksSpent || 0);

    // Step 10: Mark the task as complete
    testLogger.step(TEST_NAME, "STEP 10: Mark the task as complete");

    // Store current state before operation
    taskBeforeOp = taskAfterLogWork;

    await api.markTaskComplete(testTaskId);

    // Get updated task to verify changes
    const taskAfterMarkComplete = await api.getTask(testTaskId);

    // Marking complete should set status to ARCHIVED
    expect(taskAfterMarkComplete.status).toBe("ARCHIVED");
    expect(taskAfterMarkComplete.finished).toBeDefined();

    // Step 11: Mark the task as incomplete
    testLogger.step(TEST_NAME, "STEP 11: Mark the task as incomplete");

    // Store current state before operation
    taskBeforeOp = taskAfterMarkComplete;

    await api.markTaskIncomplete(testTaskId);

    // Get updated task to verify changes
    const taskAfterMarkIncomplete = await api.getTask(testTaskId);

    // Marking incomplete should change status from ARCHIVED
    expect(taskAfterMarkIncomplete.status).not.toBe("ARCHIVED");

    // Step 12: Clear exceptions (may not have visible effect, but should not error)
    testLogger.step(TEST_NAME, "STEP 12: Clear task exceptions");

    await api.clearTaskExceptions(testTaskId);

    // Step 13: Finally, delete the task
    testLogger.step(TEST_NAME, "STEP 13: Delete the task");

    await api.deleteTask(testTaskId);

    // Try to get the task and expect an error
    let taskDeleteVerified = false;
    try {
      await api.getTask(testTaskId);
    } catch (error) {
      // Task should no longer exist, so this is expected
      taskDeleteVerified = true;
      testLogger.step(
        TEST_NAME,
        `Verified task deletion: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    expect(taskDeleteVerified).toBe(true);

    testLogger.step(TEST_NAME, "Task lifecycle test completed successfully");
  });
});
