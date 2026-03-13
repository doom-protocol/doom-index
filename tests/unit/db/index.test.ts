import { describe, expect, it, mock } from "bun:test";

let cloudflareEnv: { DB?: D1Database } = {};

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: async (_options?: { async?: boolean }) => Promise.resolve({ env: cloudflareEnv }),
}));

describe("getDB", () => {
  it("throws a clear error when the DB binding is missing from Cloudflare context", async () => {
    cloudflareEnv = {};

    // Re-apply mock so getDB's dynamic import resolves to this env (other test files may have overwritten it)
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: async () => Promise.resolve({ env: cloudflareEnv }),
    }));

    const { getDB, resetDBForTests } = await import("@/server/db/index");
    resetDBForTests();

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
