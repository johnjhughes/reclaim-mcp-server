/**
 * @fileoverview Unit tests for the filterActiveTasks utility function
 */

import { describe, expect, it } from "vitest";
import { filterActiveTasks } from "../../src/reclaim-client.js";
import type { Task } from "../../src/types/reclaim.js";

describe("filterActiveTasks", () => {
  it("should filter out deleted tasks", () => {
    const tasks: Task[] = [
      { id: 1, title: "Task 1", deleted: false },
      { id: 2, title: "Task 2", deleted: true },
      { id: 3, title: "Task 3", deleted: false },
    ] as Task[];

    const result = filterActiveTasks(tasks);

    expect(result.length).toBe(2);
    expect(result.map((t) => t.id)).toEqual([1, 3]);
  });

  it("should filter out ARCHIVED tasks", () => {
    const tasks: Task[] = [
      { id: 1, title: "Task 1", status: "NEW" },
      { id: 2, title: "Task 2", status: "ARCHIVED" },
      { id: 3, title: "Task 3", status: "IN_PROGRESS" },
    ] as Task[];

    const result = filterActiveTasks(tasks);

    expect(result.length).toBe(2);
    expect(result.map((t) => t.id)).toEqual([1, 3]);
  });

  it("should filter out CANCELLED tasks", () => {
    const tasks: Task[] = [
      { id: 1, title: "Task 1", status: "NEW" },
      { id: 2, title: "Task 2", status: "CANCELLED" },
      { id: 3, title: "Task 3", status: "IN_PROGRESS" },
    ] as Task[];

    const result = filterActiveTasks(tasks);

    expect(result.length).toBe(2);
    expect(result.map((t) => t.id)).toEqual([1, 3]);
  });

  it("should keep COMPLETE tasks (not done, just scheduled time finished)", () => {
    const tasks: Task[] = [
      { id: 1, title: "Task 1", status: "NEW" },
      { id: 2, title: "Task 2", status: "COMPLETE" },
      { id: 3, title: "Task 3", status: "IN_PROGRESS" },
    ] as Task[];

    const result = filterActiveTasks(tasks);

    expect(result.length).toBe(3);
    expect(result.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("should handle multiple filter conditions", () => {
    const tasks: Task[] = [
      { id: 1, title: "Task 1", status: "NEW", deleted: false },
      { id: 2, title: "Task 2", status: "ARCHIVED", deleted: false },
      { id: 3, title: "Task 3", status: "IN_PROGRESS", deleted: true },
      { id: 4, title: "Task 4", status: "CANCELLED", deleted: false },
      { id: 5, title: "Task 5", status: "COMPLETE", deleted: false },
    ] as Task[];

    const result = filterActiveTasks(tasks);

    expect(result.length).toBe(2);
    expect(result.map((t) => t.id)).toEqual([1, 5]);
  });

  it("should return an empty array when passed a non-array", () => {
    const result = filterActiveTasks(null as unknown as Task[]);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});
