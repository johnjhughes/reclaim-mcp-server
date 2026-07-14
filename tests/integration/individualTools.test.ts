/**
 * @fileoverview Integration tests for individual Reclaim.ai tools
 * Each test is independent, creating and cleaning up its own tasks
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as api from "../../src/reclaim-client.js";
import type { TaskInputData } from "../../src/types/reclaim.js";
import { testLogger } from "../utils/logger.js";
import { callWithLogging, cleanupTestTasks, generateTaskTitle } from "../utils/testUtils.js";

// Test constants
const TEST_NAME = "IndividualTools";
const describeLive = process.env.RECLAIM_LIVE_TESTS === "1" ? describe : describe.skip;

describeLive("Individual Reclaim Tools", () => {
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
    // Final cleanup to ensure we don't leave anything behind
    await cleanupTestTasks(TEST_NAME);

    testLogger.suiteEnd(TEST_NAME, 8, 0);
  });

  describe("reclaim_list_tasks", () => {
    it("should list active tasks", async () => {
      testLogger.step(TEST_NAME, "Testing list tasks with active filter");

      const tasks = await callWithLogging(TEST_NAME, "listTasks", api.listTasks, []);

      expect(Array.isArray(tasks)).toBe(true);

      // Log but don't assert specific count since it depends on the account state
      testLogger.step(TEST_NAME, `Found ${tasks.length} active tasks`);
    });
  });

  describe("reclaim_create_task and reclaim_get_task", () => {
    it("should create and retrieve a task", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_CreateGet`);
      let taskId: number | undefined;

      try {
        // Create task
        testLogger.step(TEST_NAME, "Creating a test task");
        const taskData: TaskInputData = {
          title: taskTitle,
          notes: "Test task for create/get test",
          priority: "P3",
        };

        const createdTask = await callWithLogging(TEST_NAME, "createTask", api.createTask, [
          taskData,
        ]);

        taskId = createdTask.id;
        expect(createdTask.title).toBe(taskTitle);

        // Get task
        testLogger.step(TEST_NAME, `Retrieving created task with ID: ${taskId}`);
        const retrievedTask = await callWithLogging(TEST_NAME, "getTask", api.getTask, [taskId]);

        expect(retrievedTask.id).toBe(taskId);
        expect(retrievedTask.title).toBe(taskTitle);
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_update_task", () => {
    it("should update task properties", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_Update`);
      let taskId: number | undefined;

      try {
        // Create task for updating
        const createdTask = await api.createTask({
          title: taskTitle,
          notes: "Original notes",
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for update test: ${taskId}`);

        // Update task
        const updateData: TaskInputData = {
          title: `${taskTitle} (Updated)`,
          notes: "Updated notes",
          priority: "P1",
        };

        const updatedTask = await callWithLogging(TEST_NAME, "updateTask", api.updateTask, [
          taskId,
          updateData,
        ]);

        expect(updatedTask.title).toBe(updateData.title);
        expect(updatedTask.notes).toBe(updateData.notes);
        expect(updatedTask.priority).toBe(updateData.priority);
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_mark_complete and reclaim_mark_incomplete", () => {
    it("should mark task complete and incomplete", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_Complete`);
      let taskId: number | undefined;

      try {
        // Create task
        const createdTask = await api.createTask({
          title: taskTitle,
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for complete/incomplete test: ${taskId}`);

        // Mark complete
        await callWithLogging(TEST_NAME, "markTaskComplete", api.markTaskComplete, [taskId]);

        const completedTask = await api.getTask(taskId);
        expect(completedTask.status).toBe("ARCHIVED");

        // Mark incomplete
        await callWithLogging(TEST_NAME, "markTaskIncomplete", api.markTaskIncomplete, [taskId]);

        const incompletedTask = await api.getTask(taskId);
        expect(incompletedTask.status).not.toBe("ARCHIVED");
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_add_time", () => {
    it("should add time to a task", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_AddTime`);
      let taskId: number | undefined;

      try {
        // Create task with initial time
        const createdTask = await api.createTask({
          title: taskTitle,
          timeChunksRequired: 2, // 1 hour
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for add time test: ${taskId}`);
        const initialChunks = createdTask.timeChunksRequired;
        if (initialChunks === undefined) {
          throw new Error("Created task did not include timeChunksRequired");
        }

        // Add time
        await callWithLogging(
          TEST_NAME,
          "addTimeToTask",
          api.addTimeToTask,
          [taskId, 60], // Add 60 minutes (2 chunks)
        );

        const updatedTask = await api.getTask(taskId);
        expect(updatedTask.timeChunksRequired).toBe(initialChunks + 2);
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_prioritize", () => {
    it("should prioritize a task", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_Prioritize`);
      let taskId: number | undefined;

      try {
        // Create task
        const createdTask = await api.createTask({
          title: taskTitle,
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for prioritize test: ${taskId}`);

        // Prioritize
        await callWithLogging(TEST_NAME, "prioritizeTask", api.prioritizeTask, [taskId]);

        const prioritizedTask = await api.getTask(taskId);
        expect(prioritizedTask.status).toBe("SCHEDULED");
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_log_work", () => {
    it("should log work for a task", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_LogWork`);
      let taskId: number | undefined;

      try {
        // Create task
        const createdTask = await api.createTask({
          title: taskTitle,
          timeChunksRequired: 4, // 2 hours
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for log work test: ${taskId}`);
        const initialSpent = createdTask.timeChunksSpent || 0;

        // Log work
        await callWithLogging(
          TEST_NAME,
          "logWorkForTask",
          api.logWorkForTask,
          [taskId, 30], // Log 30 minutes (1 chunk)
        );

        const updatedTask = await api.getTask(taskId);
        expect(updatedTask.timeChunksSpent).toBeGreaterThan(initialSpent);
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });

  describe("reclaim_delete_task", () => {
    it("should delete a task", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_Delete`);
      let taskId: number | undefined;

      // Create task
      const createdTask = await api.createTask({
        title: taskTitle,
      });

      taskId = createdTask.id;
      testLogger.step(TEST_NAME, `Created task for delete test: ${taskId}`);

      // Delete task
      await callWithLogging(TEST_NAME, "deleteTask", api.deleteTask, [taskId]);

      // Verify deletion
      let taskDeletedVerified = false;
      try {
        await api.getTask(taskId);
      } catch {
        // Expected error - task should be gone
        taskDeletedVerified = true;
      }

      expect(taskDeletedVerified).toBe(true);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid task ID", async () => {
      const invalidId = 999999999; // Extremely large ID that shouldn't exist

      try {
        await callWithLogging(TEST_NAME, "getTask", api.getTask, [invalidId]);

        // Should not reach here
        throw new Error("Expected getTask with invalid ID to fail");
      } catch (error) {
        // Expected error
        testLogger.step(
          TEST_NAME,
          `Received expected error for invalid task ID: ${error instanceof Error ? error.message : String(error)}`,
        );
        expect(error).toBeDefined();
      }
    });

    it("should reject negative minutes for addTimeToTask", async () => {
      const taskTitle = generateTaskTitle(`${TEST_NAME}_ErrorAddTime`);
      let taskId: number | undefined;

      try {
        // Create task
        const createdTask = await api.createTask({
          title: taskTitle,
        });

        taskId = createdTask.id;
        testLogger.step(TEST_NAME, `Created task for error test: ${taskId}`);

        // Try to add negative time
        try {
          await callWithLogging(
            TEST_NAME,
            "addTimeToTask",
            api.addTimeToTask,
            [taskId, -30], // Negative minutes should be rejected
          );

          // Should not reach here
          throw new Error("Expected addTimeToTask with negative minutes to fail");
        } catch (error) {
          // Expected error
          testLogger.step(
            TEST_NAME,
            `Received expected error for negative minutes: ${error instanceof Error ? error.message : String(error)}`,
          );
          expect(error).toBeDefined();
          expect(error instanceof Error ? error.message : "").toContain("Minutes must be positive");
        }
      } finally {
        // Clean up
        if (taskId) {
          testLogger.step(TEST_NAME, `Cleaning up test task: ${taskId}`);
          await api.deleteTask(taskId);
        }
      }
    });
  });
});
