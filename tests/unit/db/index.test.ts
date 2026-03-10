import { describe, expect, it, mock } from "bun:test";

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (_options?: { async?: boolean }) => ({
    env: {},
  }),
}));

describe("getDB", () => {
  it("throws a clear error when the DB binding is missing from Cloudflare context", async () => {
    const { getDB } = (await import(
      new URL("../../../src/db/index.ts?missing-db-binding", import.meta.url).href
    )) as typeof import("../../../src/db/index");
    let thrown: unknown;
    try {
      await getDB();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    if (thrown instanceof Error) {
      expect(thrown.message).toBe("D1 DB binding not found (env.DB). Check wrangler.toml [[d1_databases]].");
    }
  });
});
