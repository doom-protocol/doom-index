/**
 * Mocks @opennextjs/cloudflare with empty env for unit tests that need no bindings.
 * Import this before any module that imports getCloudflareContext (e.g. workers-ai-client).
 */
import { mock } from "bun:test";

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => Promise.resolve({ env: {} }),
}));
