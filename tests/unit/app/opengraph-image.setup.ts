/**
 * Sets up @opennextjs/cloudflare mock before opengraph-image is imported.
 * Import this first in opengraph-image.component.test.tsx.
 */
import { mock } from "bun:test";

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async () => {
    await Promise.resolve();
    return { env: {} };
  },
}));
