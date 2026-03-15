import { describe, expect, it } from "bun:test";

function runCloudflareContextCheck(script: string) {
  const result = Bun.spawnSync({
    cmd: [
      "bun",
      "--eval",
      `
        const { resolveCloudflareEnvFromLoaders } = await import("@/lib/cloudflare-context");

        ${script}
      `,
    ],
    cwd: process.cwd(),
    env: {
      ...process.env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  expect(result.exitCode).toBe(0);

  return JSON.parse(new TextDecoder().decode(result.stdout).trim()) as Record<string, boolean | number>;
}

describe("resolveCloudflareEnvFromLoaders", () => {
  it("prefers cloudflare:workers bindings when available", () => {
    const output = runCloudflareContextCheck(`
      const workersEnv = { DB: { prepare: () => null } };
      let globalOverrideCalls = 0;

      const env = await resolveCloudflareEnvFromLoaders({
        loadCloudflareWorkersEnv: async () => workersEnv,
        loadGlobalEnvOverride: () => {
          globalOverrideCalls += 1;
          return undefined;
        },
      });

      console.log(JSON.stringify({
        globalOverrideCalls,
        isWorkersEnv: env === workersEnv,
      }));
    `);

    expect(output.isWorkersEnv).toBe(true);
    expect(output.globalOverrideCalls).toBe(0);
  });

  it("falls back to an explicit runtime override when cloudflare:workers bindings are unavailable", () => {
    const output = runCloudflareContextCheck(`
      const overrideEnv = {
        VIEWER_KV: {
          get: async () => null,
        },
      };

      const env = await resolveCloudflareEnvFromLoaders({
        loadCloudflareWorkersEnv: async () => undefined,
        loadGlobalEnvOverride: () => overrideEnv,
      });

      console.log(JSON.stringify({
        isOverrideEnv: env === overrideEnv,
      }));
    `);

    expect(output.isOverrideEnv).toBe(true);
  });

  it("returns undefined when neither runtime exposes Cloudflare bindings", () => {
    const output = runCloudflareContextCheck(`
      const env = await resolveCloudflareEnvFromLoaders({
        loadCloudflareWorkersEnv: async () => undefined,
        loadGlobalEnvOverride: () => undefined,
      });

      console.log(JSON.stringify({
        isUndefined: env === undefined,
      }));
    `);

    expect(output.isUndefined).toBe(true);
  });
});
