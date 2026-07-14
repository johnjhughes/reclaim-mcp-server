import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use longer timeout for API-calling tests
    testTimeout: 30000,

    // Environment configuration
    environmentOptions: {
      // Load environment variables from .env file
      setupFiles: [".env"],
    },

    // Include source maps for better error reporting
    include: ["tests/**/*.test.ts"],

    // Use native ESM with TypeScript
    environment: "node",

    // Coverage configuration
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/tests/**", "dist/**", "vitest.config.ts"],
    },
  },
});
