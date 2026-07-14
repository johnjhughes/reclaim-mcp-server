/**
 * @fileoverview Utility functions for the Reclaim MCP server.
 */

import { logger } from "./logger.js"; // Import the logger utility
// Import necessary types from the SDK and local types
import { ReclaimError } from "./types/reclaim.js"; // Fixed import path with .js extension

import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

/**
 * Type for error detail object structure
 */
type ErrorDetailObject = {
  title?: string;
  detail?: string;
  message?: string;
};

/**
 * Format successful API response into MCP ToolResult
 *
 * @param result - The result from the API call
 * @returns Formatted CallToolResult object
 */
function formatSuccessResult(result: unknown): CallToolResult {
  let contentParts: TextContent[];

  // Handle successful void promises (e.g., from deleteTask)
  if (result === undefined) {
    contentParts = [{ type: "text", text: JSON.stringify({ success: true }, null, 2) }];
  } else {
    // Attempt to stringify complex objects, otherwise return simple types as string
    const resultText =
      typeof result === "object" && result !== null
        ? JSON.stringify(result, null, 2) // Pretty-print JSON results
        : String(result);

    // Always return as 'text' content type for simplicity
    contentParts = [{ type: "text", text: resultText }];
  }

  return {
    content: contentParts,
  };
}

/**
 * Extract error details from an unknown error
 *
 * @param e - The caught error
 * @returns Object containing error message, detail, and code
 */
function extractErrorInfo(e: unknown): {
  errorMessage: string;
  errorDetail: unknown;
  errorCode: number | undefined;
} {
  let errorMessage = "An unknown error occurred.";
  let errorDetail: unknown = undefined;
  let errorCode: number | undefined = undefined;

  if (e instanceof ReclaimError) {
    errorMessage = e.message;
    errorDetail = e.detail;
    errorCode = e.status;
  } else if (e instanceof Error) {
    errorMessage = e.message;
    errorDetail = { stack: e.stack };
  } else {
    errorMessage = `An unexpected non-Error value was thrown: ${String(e)}`;
    errorDetail = e;
  }

  return { errorMessage, errorDetail, errorCode };
}

/**
 * Extract a detail string from error details
 *
 * @param errorDetail - The error detail object or string
 * @param errorMessage - The main error message
 * @returns A formatted detail string or undefined
 */
function extractDetailString(errorDetail: unknown, errorMessage: string): string | undefined {
  if (!errorDetail) return undefined;

  if (typeof errorDetail === "object") {
    const errorObj = errorDetail as ErrorDetailObject;

    // Check for detail property
    if (errorObj.detail && typeof errorObj.detail === "string" && errorObj.detail.length < 150) {
      return errorObj.detail;
    }

    // Check for message property
    if (
      errorObj.message &&
      typeof errorObj.message === "string" &&
      errorObj.message !== errorMessage
    ) {
      return errorObj.message;
    }
  } else if (
    typeof errorDetail === "string" &&
    errorDetail.length < 150 &&
    errorDetail !== errorMessage
  ) {
    return errorDetail;
  }

  return undefined;
}

/**
 * Wraps an API call promise, formatting the result or error into an MCP ToolResult structure.
 * Provides detailed error messages for better debugging and client feedback.
 * Handles successful void promises by returning a standard success object.
 *
 * @param promise - The promise returned by a `reclaim-client` API function.
 * @returns A Promise resolving to the SDK's `CallToolResult`.
 */
export async function wrapApiCall(promise: Promise<unknown>): Promise<CallToolResult> {
  try {
    const result = await promise;
    return formatSuccessResult(result);
  } catch (e: unknown) {
    // Extract error information
    const { errorMessage, errorDetail, errorCode } = extractErrorInfo(e);

    // Log the detailed error server-side for debugging
    logger.error(`MCP Tool Error: ${errorMessage}`, {
      code: errorCode,
      detail: errorDetail,
    });

    // Construct a user-friendly error message
    let userMessage = errorCode ? `Error ${errorCode}: ${errorMessage}` : `Error: ${errorMessage}`;

    // Add title if available
    if (errorDetail && typeof errorDetail === "object") {
      const errorObj = errorDetail as ErrorDetailObject;
      if (errorObj.title && typeof errorObj.title === "string") {
        userMessage += ` - ${errorObj.title}`;
      }
    }

    // Add detail information if available
    const detailString = extractDetailString(errorDetail, errorMessage);
    if (detailString) {
      userMessage += ` (${detailString})`;
    }

    // Return the error structure for MCP
    return {
      isError: true,
      content: [{ type: "text", text: userMessage }],
    };
  }
}
