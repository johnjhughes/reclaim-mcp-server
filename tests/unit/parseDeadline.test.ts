/**
 * @fileoverview Unit tests for the parseDeadline utility function
 */

import { describe, expect, it } from "vitest";
import { parseDeadline } from "../../src/reclaim-client.js";

describe("parseDeadline", () => {
  // Helper to check if two ISO strings are within a second of each other
  const isoStringsClose = (a: string, b: string): boolean => {
    const dateA = new Date(a).getTime();
    const dateB = new Date(b).getTime();
    return Math.abs(dateA - dateB) < 1000; // Within 1 second
  };

  it("should handle numeric days correctly", () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = parseDeadline(1);

    expect(isoStringsClose(result, tomorrow.toISOString())).toBe(true);
  });

  it("should handle ISO date strings", () => {
    const isoString = "2025-12-31T23:59:59.999Z";
    const result = parseDeadline(isoString);

    expect(result).toBe(isoString);
  });

  it("should handle YYYY-MM-DD date strings", () => {
    const dateString = "2025-12-31";
    const result = parseDeadline(dateString);
    const expected = new Date(Date.UTC(2025, 11, 31)).toISOString();

    expect(isoStringsClose(result, expected)).toBe(true);
  });

  it("should default to 24 hours from now when undefined is passed", () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = parseDeadline(undefined);

    expect(isoStringsClose(result, tomorrow.toISOString())).toBe(true);
  });

  it("should handle invalid date strings by using the default", () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = parseDeadline("not-a-date");

    expect(isoStringsClose(result, tomorrow.toISOString())).toBe(true);
  });

  it("should default to current time when zero days are passed", () => {
    const now = new Date();

    const result = parseDeadline(0);

    expect(isoStringsClose(result, now.toISOString())).toBe(true);
  });
});
