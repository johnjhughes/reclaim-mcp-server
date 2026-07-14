/**
 * @fileoverview In-process MCP client/server utilities for handler-level tests.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

import { initializeServer } from "../../src/index.js";
import type { ReclaimApiClient } from "../../src/types/reclaim.js";

export interface TestEnvironment {
  server: Server;
  client: Client;
}

/**
 * Connects an MCP client to the real server handlers through linked in-memory transports.
 */
export async function setupTestEnvironment(
  mockApiClient: ReclaimApiClient,
): Promise<TestEnvironment> {
  const server = initializeServer({
    isTestMode: true,
    apiClient: mockApiClient,
  });
  const client = new Client({
    name: "reclaim-mcp-test-client",
    version: "1.0.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { server, client };
}

/**
 * Closes both sides of an in-process test connection.
 */
export async function cleanupTestEnvironment({ client, server }: TestEnvironment): Promise<void> {
  await client.close();
  await server.close();
}
