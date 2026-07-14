/**
 * @fileoverview Consistency tests for the in-memory Reclaim API client.
 */

import { describe, expect, it } from "vitest";

import { createReclaimApiMock } from "../utils/reclaim-api-mock.js";

describe("Reclaim API mock", () => {
  it("returns the same normalized task state that it stores", async () => {
    const api = createReclaimApiMock();
    const created = await api.createTask({ title: "Mock consistency" });
    const updated = await api.updateTask(created.id, {
      title: "Updated mock consistency",
      deadline: "2030-01-02",
    });

    expect(updated).toEqual(await api.getTask(created.id));
    expect(updated).not.toHaveProperty("deadline");
  });
});
