#!/usr/bin/env node
/**
 * @fileoverview Main entry point for the Reclaim.ai MCP Server.
 * Initializes the server, registers tools and resources, and connects the transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// ServerInfo is inferred from the constructor argument, no explicit import needed.
// import { ServerInfo } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerTaskResources } from "./resources/tasks.js";
import { registerTaskActionTools } from "./tools/taskActions.js";
import { registerTaskCrudTools } from "./tools/taskCrud.js";
import "dotenv/config"; // Load environment variables from .env file

// --- Server Information ---
// Read version from package.json (more robust than hardcoding)
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let pkg: any; // Use any for flexibility, or define a specific interface
try {
  // Adjust path if needed, assuming package.json is one level up from src/
  pkg = require("../package.json");
} catch (e) {
  console.error("Could not read package.json, using default server info.", e);
  pkg = {}; // Default to empty object if read fails
}

// Define the structure expected for server info (matches McpServer constructor)
const serverInfo = {
  name: pkg.name || "reclaim-mcp-server",
  version: pkg.version || "0.0.0", // Fallback version
  publisher: pkg.author || "Unknown Publisher",
  homepage: pkg.homepage || undefined,
  supportUrl: pkg.bugs?.url || undefined,
  description: pkg.description || "MCP Server for Reclaim.ai Tasks",
};

/**
 * Initializes and starts the Reclaim MCP Server.
 * - Sets up server info.
 * - Registers all defined tools and resources.
 * - Connects to the specified transport (currently Stdio).
 * - Handles potential startup errors.
 */
async function main(): Promise<void> {
  // Use console.error for ALL operational logs to keep stdout clean for JSON-RPC
  console.error(`Initializing ${serverInfo.name} v${serverInfo.version}...`);

  // Crucial check: Ensure the API token is loaded.
  if (!process.env.RECLAIM_API_KEY) {
    console.error(
      "FATAL ERROR: RECLAIM_API_KEY environment variable is not set.",
    );
    console.error(
      "Please ensure a .env file exists in the project root and contains your Reclaim.ai API token.",
    );
    console.error(`Example: RECLAIM_API_KEY=your_api_token_here`);
    process.exit(1); // Exit immediately if token is missing.
  } else {
    // Avoid logging the token itself!
    console.error("Reclaim API Token found in environment variables.");
  }

  // Create the MCP Server instance with server information.
  const server = new McpServer(serverInfo);
  console.error(`Server instance created for "${serverInfo.name}".`);

  // Register all features (Tools and Resources).
  console.error("Registering MCP features...");
  try {
    registerTaskActionTools(server);
    registerTaskCrudTools(server);
    registerTaskResources(server);
    console.error("All tools and resources registered successfully.");
  } catch (registrationError) {
    console.error(
      "FATAL ERROR during feature registration:",
      registrationError,
    );
    process.exit(1);
  }

  // Create and connect the transport (Stdio by default).
  // Stdio transport reads JSON-RPC from stdin and writes to stdout.
  console.error("Attempting to connect via StdioServerTransport...");
  const transport = new StdioServerTransport();

  try {
    // Establish connection between the server logic and the transport layer.
    await server.connect(transport);
    // Use console.error for successful startup message to separate from protocol messages on stdout.
    console.error(
      `✅ ${serverInfo.name} is running and connected via stdio. Listening for MCP messages on stdin...`,
    );
  } catch (connectionError) {
    console.error(
      "FATAL ERROR: Failed to connect MCP server to stdio transport:",
      connectionError,
    );
    process.exit(1);
  }
}

// --- Global Error Handling & Execution ---

// Catch unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Catch uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Execute the main function and handle top-level errors.
main().catch((error) => {
  console.error("FATAL ERROR during server startup sequence:", error);
  process.exit(1); // Exit if main function fails critically.
});
