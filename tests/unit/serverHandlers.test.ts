/**
 * @fileoverview CI-safe tests for the MCP server's static handler routing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type TestEnvironment,
  cleanupTestEnvironment,
  setupTestEnvironment,
} from "../utils/mcp-test-utils.js";
import { createReclaimApiMock } from "../utils/reclaim-api-mock.js";

function firstText(result: unknown): string {
  if (typeof result !== "object" || result === null || !("content" in result)) {
    throw new Error("Expected a tool result with content");
  }

  const items = result.content;
  const content = Array.isArray(items) ? items[0] : undefined;
  if (
    typeof content !== "object" ||
    content === null ||
    !("type" in content) ||
    content.type !== "text" ||
    !("text" in content) ||
    typeof content.text !== "string"
  ) {
    throw new Error("Expected the first tool result item to contain text");
  }
  return content.text;
}

describe("MCP server handlers", () => {
  let environment: TestEnvironment;

  beforeEach(async () => {
    environment = await setupTestEnvironment(createReclaimApiMock());
  });

  afterEach(async () => {
    await cleanupTestEnvironment(environment);
  });

  it("lists the static Reclaim tool definitions", async () => {
    const result = await environment.client.listTools();

    expect(result.tools.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "reclaim_list_tasks",
        "reclaim_create_task",
        "reclaim_update_task",
        "reclaim_delete_task",
      ]),
    );
    expect(result.tools).toHaveLength(13);
  });

  it("routes create and get calls through the injected API client", async () => {
    const createResult = await environment.client.callTool({
      name: "reclaim_create_task",
      arguments: {
        title: "Handler test task",
        priority: "P2",
        timeChunksRequired: 3,
      },
    });
    expect(createResult.isError).not.toBe(true);

    const createdTask = JSON.parse(firstText(createResult)) as { id: number; title: string };
    const getResult = await environment.client.callTool({
      name: "reclaim_get_task",
      arguments: { taskId: createdTask.id },
    });

    expect(getResult.isError).not.toBe(true);
    expect(JSON.parse(firstText(getResult))).toMatchObject({
      id: createdTask.id,
      title: "Handler test task",
      priority: "P2",
      timeChunksRequired: 3,
    });
  });

  it("applies active-task filtering without calling Reclaim", async () => {
    const result = await environment.client.callTool({
      name: "reclaim_list_tasks",
      arguments: { filter: "active" },
    });

    expect(result.isError).not.toBe(true);
    const tasks = JSON.parse(firstText(result)) as Array<{ id: number }>;
    expect(tasks.map(({ id }) => id)).toEqual([12345, 67890, 24680]);
  });

  it("lists and reads the active-tasks resource through the injected client", async () => {
    const listed = await environment.client.listResources();
    expect(listed.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: "tasks://active",
          mimeType: "application/json",
        }),
      ]),
    );

    const read = await environment.client.readResource({ uri: "tasks://active" });
    const first = read.contents[0];
    if (!first || !("text" in first) || typeof first.text !== "string") {
      throw new Error("Expected the active-tasks resource to contain JSON text");
    }

    const tasks = JSON.parse(first.text) as Array<{ id: number }>;
    expect(tasks.map(({ id }) => id)).toEqual([12345, 67890, 24680]);
  });

  it("returns MCP errors for invalid arguments and unknown tools", async () => {
    const invalidResult = await environment.client.callTool({
      name: "reclaim_get_task",
      arguments: { taskId: -1 },
    });
    const unknownResult = await environment.client.callTool({
      name: "reclaim_not_a_tool",
      arguments: {},
    });

    expect(invalidResult.isError).toBe(true);
    expect(firstText(invalidResult)).toContain("Error calling reclaim_get_task");
    expect(unknownResult.isError).toBe(true);
    expect(firstText(unknownResult)).toBe('Tool "reclaim_not_a_tool" not found.');
  });
});
