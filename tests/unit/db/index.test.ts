import { describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

interface DbIndexModule {
  getDB: (d1Binding?: D1Database) => Promise<unknown>;
}

async function importDbIndex(): Promise<DbIndexModule> {
  mock.restore();
  void mock.module("@opennextjs/cloudflare", () => ({
    getCloudflareContext: async () => Promise.resolve({ env: {} }),
  }));
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/db/index.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as DbIndexModule;
}

describe("getDB", () => {
  it("throws a clear error when the DB binding is missing from Cloudflare context", async () => {
    const { getDB } = await importDbIndex();

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
