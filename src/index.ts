#!/usr/bin/env node
/**
 * @fileoverview Main entry point for the Reclaim.ai MCP Server.
 * Initializes the server, registers tools and resources via explicit handlers,
 * and connects the transport.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config"; // Load environment variables from .env file
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { logger } from "./logger.js";
import * as defaultApi from "./reclaim-client.js"; // Import the actual API client implementation
import { registerTaskResources } from "./resources/tasks.js";
import { toolDefinitions } from "./tools/definitions.js"; // Import the static tool definitions

// Import handler functions from taskActions and taskCrud
import * as taskActions from "./tools/taskActions.js";
import * as taskCrud from "./tools/taskCrud.js";

import type { ReclaimApiClient } from "./types/reclaim.js"; // Import API client type

// --- Server Information ---
const require = createRequire(import.meta.url);
type PackageJson = {
  name?: string;
  version?: string;
  author?: string;
  homepage?: string;
  bugs?: { url?: string };
  description?: string;
};
let pkg: PackageJson = {};
try {
  pkg = require("../package.json");
} catch (e) {
  logger.error("Could not read package.json, using default server info.", e);
  pkg = {};
}

const serverInfo = {
  name: pkg.name || "reclaim-mcp-server",
  version: pkg.version || "0.0.0",
  publisher: pkg.author || "Unknown Publisher",
  homepage: pkg.homepage || undefined,
  supportUrl: pkg.bugs?.url || undefined,
  description: pkg.description || "MCP Server for Reclaim.ai Tasks",
};

// --- Server Configuration & Initialization ---
export interface ServerConfig {
  isTestMode?: boolean;
  apiKey?: string;
  // Allow injecting API client for tests OR use default
  apiClient?: ReclaimApiClient;
}

/**
 * Logs SDK version information for debugging.
 */
function logSdkVersion(): void {
  try {
    const sdkPackage = require("@modelcontextprotocol/sdk/package.json");
    logger.error(`MCP SDK version: ${sdkPackage.version}`);
  } catch (e) {
    logger.error("Could not determine MCP SDK version", e);
  }
}

/**
 * Type definition for handler functions using the SDK's CallToolResult
 */
type ToolHandler = (params: unknown, apiClient: ReclaimApiClient) => Promise<CallToolResult>; // Use CallToolResult from SDK types

/**
 * Map tool names to their handler functions using Map to avoid naming convention lint.
 * This acts as the router for the CallToolRequestSchema handler.
 */
const toolHandlers = new Map<string, ToolHandler>([
  ["reclaim_list_tasks", taskActions.handleListTasks],
  ["reclaim_get_task", taskActions.handleGetTask],
  ["reclaim_mark_complete", taskActions.handleMarkComplete],
  ["reclaim_mark_incomplete", taskActions.handleMarkIncomplete],
  ["reclaim_delete_task", taskActions.handleDeleteTask],
  ["reclaim_add_time", taskActions.handleAddTime],
  ["reclaim_start_timer", taskActions.handleStartTimer],
  ["reclaim_stop_timer", taskActions.handleStopTimer],
  ["reclaim_log_work", taskActions.handleLogWork],
  ["reclaim_clear_exceptions", taskActions.handleClearExceptions],
  ["reclaim_prioritize", taskActions.handlePrioritize],
  // Task CRUD
  ["reclaim_create_task", taskCrud.handleCreateTask],
  ["reclaim_update_task", taskCrud.handleUpdateTask], // This assignment should now be valid
]);

/**
 * Initializes the Reclaim MCP Server with the provided configuration.
 * - Sets up server info.
 * - Registers EXPLICIT handlers for ListToolsRequestSchema and CallToolRequestSchema.
 * - Returns the server instance but does not connect it to a transport.
 *
 * @param config - Optional configuration for server initialization
 * @returns The initialized server instance
 */
export function initializeServer(config: ServerConfig = {}): Server {
  const { isTestMode = false, apiKey = process.env.RECLAIM_API_KEY } = config;
  // Use injected apiClient if provided (for tests), otherwise use the default import
  const apiClient = config.apiClient || defaultApi;

  if (!apiKey && !isTestMode) {
    logger.error("FATAL ERROR: RECLAIM_API_KEY environment variable is not set.");
    process.exit(1);
  } else if (apiKey) {
    logger.error("Reclaim API Token found.");
  } else {
    logger.error("Running in test mode with no API key or using mock client.");
  }

  const server = new Server(serverInfo, { capabilities: { tools: {} } });
  logger.error(`Server instance created for "${serverInfo.name}".`);

  // Log SDK version for debugging
  logSdkVersion();

  // --- Register EXPLICIT Handlers ---

  // 1. ListTools Handler: Returns the static list of tool definitions.
  logger.error("Registering ListToolsRequestSchema handler...");
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("ListTools request received. Returning definitions.");
    // Ensure the structure matches { tools: [...] }
    // The imported toolDefinitions should now have the correct type.
    return {
      tools: toolDefinitions,
    };
  });
  logger.error("ListToolsRequestSchema handler registered.");

  // 2. CallTool Handler: Routes requests to the appropriate handler function.
  logger.error("Registering CallToolRequestSchema handler...");
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments;

    logger.debug(`CallTool request received for tool: ${toolName}`);
    logger.debug(`Arguments: ${JSON.stringify(args)}`);

    const handler = toolHandlers.get(toolName);

    if (handler) {
      try {
        // Call the specific handler function, passing the raw arguments and the API client
        const result: CallToolResult = await handler(args, apiClient); // Result is typed
        logger.debug(`Tool ${toolName} executed successfully.`);
        return result;
      } catch (error: unknown) {
        logger.error(`Error executing tool ${toolName}:`, error);
        // Handle Zod validation errors or other exceptions from the handler
        const errorMessage =
          error instanceof Error
            ? error.message
            : "An unknown error occurred during tool execution.";
        // Construct the error result conforming to CallToolResult
        const errorResult: CallToolResult = {
          isError: true,
          content: [{ type: "text", text: `Error calling ${toolName}: ${errorMessage}` }], // Explicitly TextContent
        };
        return errorResult;
      }
    } else {
      logger.error(`Tool not found: ${toolName}`);
      // Construct the error result conforming to CallToolResult
      const errorResult: CallToolResult = {
        isError: true,
        content: [{ type: "text", text: `Tool "${toolName}" not found.` }], // Explicitly TextContent
      };
      return errorResult;
    }
  });
  logger.error("CallToolRequestSchema handler registered.");

  registerTaskResources(server, apiClient);
  logger.error("Task resources registered.");

  return server;
}

/**
 * Main function to initialize and start the server with Stdio transport.
 */
async function main(): Promise<void> {
  logger.error(`Initializing ${serverInfo.name} v${serverInfo.version}...`);
  const server = initializeServer(); // Uses default API client and explicit handlers

  logger.error("Attempting to connect via StdioServerTransport...");
  const transport = new StdioServerTransport();

  try {
    await server.connect(transport);
    logger.error(
      `✅ ${serverInfo.name} is running and connected via stdio. Listening for MCP messages on stdin...`,
    );
  } catch (connectionError) {
    logger.error("FATAL ERROR: Failed to connect MCP server to stdio transport:", connectionError);
    process.exit(1);
  }
}

// --- Global Error Handling & Execution ---
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
});

// Execute main only if running as script.
const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error) => {
    logger.error("FATAL ERROR during server startup sequence:", error);
    process.exit(1);
  });
}
