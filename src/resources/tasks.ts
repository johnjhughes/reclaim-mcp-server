/**
 * @fileoverview Registers MCP Resources related to fetching Reclaim.ai task data.
 * Currently includes a resource for listing active tasks.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  type ReadResourceResult,
  type Resource,
} from "@modelcontextprotocol/sdk/types.js";

import { logger } from "../logger.js";
import * as defaultApi from "../reclaim-client.js";
import { type ReclaimApiClient, ReclaimError } from "../types/reclaim.js";

const activeTasksUri = "tasks://active";

const activeTasksResource: Resource = {
  uri: activeTasksUri,
  name: "reclaim_active_tasks",
  title: "Active Reclaim Tasks",
  description:
    "Provides a list of all active tasks from Reclaim.ai as a JSON array. Active means tasks that are not deleted and whose status is not ARCHIVED or CANCELLED.\n" +
    "IMPORTANT NOTE ON 'COMPLETE' STATUS: Tasks with status 'COMPLETE' (meaning scheduled time is finished) ARE INCLUDED here because the user has NOT marked them as done. These should be treated as active, potentially past-due tasks, not finished items.",
  mimeType: "application/json",
  readOnlyHint: true,
};

/**
 * Wraps an API call promise specifically for MCP Resource handlers.
 * Formats the successful result into a properly structured resource result (ReadResourceResult).
 *
 * @param uri - The canonical URI string for the resource being accessed.
 * @param promise - The promise returned by the `reclaim-client` function fetching resource data.
 * @returns A Promise resolving to the SDK's `ReadResourceResult`.
 * @throws {Error} Throws a descriptive error if the underlying API call fails, to be handled by the MCP framework.
 */
async function wrapResourceCall(
  uri: string,
  promise: Promise<unknown>,
): Promise<ReadResourceResult> {
  try {
    const result = await promise;
    // Resources typically return structured data; stringify for the text content.
    const jsonText = JSON.stringify(result, null, 2); // Pretty-print JSON

    // Construct the ResourceContents array matching the SDK's expected structure
    const contents = [
      {
        uri: uri,
        mimeType: "application/json", // Specify the mime type
        text: jsonText, // Provide the content as text
        // Use 'blob' property instead of 'text' for binary data
      },
    ];

    // Return structure matches SDK examples: { contents: Array }
    return {
      contents: contents,
    };
  } catch (e: unknown) {
    // Catch variable is 'unknown'
    // Normalize the error message
    let errorMessage = "Failed to fetch resource data.";
    let errorDetail: string | undefined;

    // Use type guards to safely access properties
    if (e instanceof ReclaimError) {
      errorMessage = e.message; // Use formatted message from client
      // Safely stringify detail if it exists
      errorDetail = e.detail ? JSON.stringify(e.detail) : undefined;
    } else if (e instanceof Error) {
      errorMessage = e.message; // Standard Error message
    } else {
      errorMessage = String(e); // Fallback for non-Error types
    }

    // Log the detailed error server-side
    logger.error(
      `MCP Resource Error (URI: ${uri}): ${errorMessage}`,
      errorDetail ? `\nDetail: ${errorDetail}` : "",
    );

    // Throw a new error to be handled by the MCP server framework for resource failures.
    // The framework should convert this into an appropriate JSON-RPC error response.
    throw new Error(`Failed to fetch resource ${uri}: ${errorMessage}`);
  }
}

/**
 * Registers all task-related resources with the provided MCP Server instance.
 * Currently registers the 'tasks://active' resource.
 *
 * @param server - The low-level MCP Server instance to register resource handlers against.
 * @param apiClient - Optional API client for dependency injection (used in testing)
 */
export function registerTaskResources(
  server: Server,
  apiClient: ReclaimApiClient = defaultApi,
): void {
  server.registerCapabilities({ resources: {} });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [activeTasksResource],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri !== activeTasksUri) {
      throw new McpError(ErrorCode.InvalidParams, `Resource ${uri} not found`);
    }

    const activeTasksPromise = apiClient
      .listTasks()
      .then((allTasks) => apiClient.filterActiveTasks(allTasks));
    return wrapResourceCall(uri, activeTasksPromise);
  });
}
