import { beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function loadCloudflareContextModule() {
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/cloudflare-context.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);

  return import(moduleUrl.href) as Promise<typeof import("@/lib/cloudflare-context")>;
}

describe("resolveCloudflareEnvFromLoaders", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("prefers cloudflare:workers bindings when available", async () => {
    const { resolveCloudflareEnvFromLoaders } = await loadCloudflareContextModule();
    const workersEnv = { DB: { prepare: () => null } } as unknown as CloudflareEnv;
    let globalOverrideCalls = 0;

    const env = await resolveCloudflareEnvFromLoaders({
      loadCloudflareWorkersEnv: async () => Promise.resolve(workersEnv),
      loadGlobalEnvOverride: () => {
        globalOverrideCalls += 1;
        return undefined;
      },
    });

    expect(env).toBe(workersEnv);
    expect(globalOverrideCalls).toBe(0);
  });

  it("falls back to an explicit runtime override when cloudflare:workers bindings are unavailable", async () => {
    const { resolveCloudflareEnvFromLoaders } = await loadCloudflareContextModule();
    const overrideEnv = {
      VIEWER_KV: {
        get: async () => Promise.resolve(null),
      },
    } as unknown as CloudflareEnv;

    const env = await resolveCloudflareEnvFromLoaders({
      loadCloudflareWorkersEnv: async () => Promise.resolve(undefined),
      loadGlobalEnvOverride: () => overrideEnv,
    });

    expect(env).toBe(overrideEnv);
  });

  it("returns undefined when neither runtime exposes Cloudflare bindings", async () => {
    const { resolveCloudflareEnvFromLoaders } = await loadCloudflareContextModule();
    const env = await resolveCloudflareEnvFromLoaders({
      loadCloudflareWorkersEnv: async () => Promise.resolve(undefined),
      loadGlobalEnvOverride: () => undefined,
    });

    expect(env).toBeUndefined();
  });
});
