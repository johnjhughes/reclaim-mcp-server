/**
 * @fileoverview Tests for import-time and request-time Reclaim API authentication behavior.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Reclaim API authentication", () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.RECLAIM_API_KEY;
    Reflect.deleteProperty(process.env, "RECLAIM_API_KEY");
    vi.resetModules();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      Reflect.deleteProperty(process.env, "RECLAIM_API_KEY");
    } else {
      process.env.RECLAIM_API_KEY = originalApiKey;
    }
  });

  it("can be imported without an API key", async () => {
    const api = await import("../../src/reclaim-client.js");

    expect(api.reclaim.defaults.baseURL).toBe("https://api.app.reclaim.ai/api/");
  });

  it("fails clearly before making a request without an API key", async () => {
    const api = await import("../../src/reclaim-client.js");

    await expect(api.listTasks()).rejects.toMatchObject({
      message: expect.stringContaining("RECLAIM_API_KEY environment variable is not set"),
    });
  });
});
