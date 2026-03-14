import { describe, expect, it } from "bun:test";

import { resolveCloudflareEnvFromLoaders } from "@/lib/cloudflare-context";

describe("resolveCloudflareEnvFromLoaders", () => {
  it("prefers cloudflare:workers bindings when available", async () => {
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
    const env = await resolveCloudflareEnvFromLoaders({
      loadCloudflareWorkersEnv: async () => Promise.resolve(undefined),
      loadGlobalEnvOverride: () => undefined,
    });

    expect(env).toBeUndefined();
  });
});
