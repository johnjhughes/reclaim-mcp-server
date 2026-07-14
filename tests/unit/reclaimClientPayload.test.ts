/**
 * @fileoverview Tests for outbound Reclaim task payload normalization.
 */

import nock from "nock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTask, updateTask } from "../../src/reclaim-client.js";
import type { TaskInputData } from "../../src/types/reclaim.js";

describe("Reclaim task payloads", () => {
  beforeEach(() => {
    process.env.RECLAIM_API_KEY = "test-key";
  });

  afterEach(() => {
    nock.cleanAll();
    Reflect.deleteProperty(process.env, "RECLAIM_API_KEY");
  });

  it("converts create deadline and snooze fields without mutating the caller", async () => {
    const input = {
      title: "Payload test",
      deadline: "2030-01-02",
      snoozeUntil: "2030-01-01",
      notes: undefined,
    } as unknown as TaskInputData;

    const request = nock("https://api.app.reclaim.ai")
      .post("/api/tasks", (body: Record<string, unknown>) => {
        expect(body).toEqual({
          title: "Payload test",
          due: "2030-01-02T00:00:00.000Z",
          snoozeUntil: "2030-01-01T00:00:00.000Z",
        });
        expect(body).not.toHaveProperty("deadline");
        return true;
      })
      .reply(200, { id: 1, title: "Payload test" });

    await expect(createTask(input)).resolves.toMatchObject({ id: 1 });
    expect(input).toEqual({
      title: "Payload test",
      deadline: "2030-01-02",
      snoozeUntil: "2030-01-01",
      notes: undefined,
    });
    expect(request.isDone()).toBe(true);
  });

  it("converts update deadline and removes undefined values", async () => {
    const request = nock("https://api.app.reclaim.ai")
      .patch("/api/tasks/42", (body: Record<string, unknown>) => {
        expect(body).toEqual({
          title: "Updated",
          due: "2030-02-03T00:00:00.000Z",
        });
        expect(body).not.toHaveProperty("deadline");
        return true;
      })
      .reply(200, { id: 42, title: "Updated" });

    await expect(
      updateTask(42, {
        title: "Updated",
        deadline: "2030-02-03",
        notes: undefined,
      } as unknown as TaskInputData),
    ).resolves.toMatchObject({ id: 42 });
    expect(request.isDone()).toBe(true);
  });
});
