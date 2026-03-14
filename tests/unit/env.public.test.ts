import { describe, expect, it } from "bun:test";

const runEnvScript = (script: string, overrides?: Record<string, string | undefined>) => {
  const env = { ...process.env };
  env.NEXT_PUBLIC_BASE_URL = "http://localhost:8787";
  env.NEXT_PUBLIC_ENABLE_LEVA = "false";
  env.NEXT_PUBLIC_GENERATION_INTERVAL_MS = "600000";
  env.LOG_LEVEL = "DEBUG";
  Reflect.deleteProperty(env, "RUNWARE_API_KEY");

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        Reflect.deleteProperty(env, key);
        continue;
      }

      env[key] = value;
    }
  }

  return Bun.spawnSync({
    cmd: ["bun", "--eval", script],
    cwd: process.cwd(),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
};

describe("unit/env.public", () => {
  it("reads public env helpers without validating server-only variables in a client runtime", () => {
    const result = runEnvScript(`
      globalThis.window = { location: { origin: "http://localhost:8787" } };
      const envModule = await import("./src/env.ts");
      console.log(JSON.stringify({
        isDevelopment: envModule.isDevelopment(),
        isLevaEnabled: envModule.isLevaEnabled(),
        environmentName: envModule.getEnvironmentName(),
        logLevel: envModule.publicEnv.LOG_LEVEL,
        generationIntervalMs: envModule.publicEnv.NEXT_PUBLIC_GENERATION_INTERVAL_MS,
      }));
    `);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      environmentName: string;
      generationIntervalMs: number;
      isDevelopment: boolean;
      isLevaEnabled: boolean;
      logLevel: string;
    };

    expect(output.isDevelopment).toBe(true);
    expect(output.isLevaEnabled).toBe(false);
    expect(output.environmentName).toBe("development");
    expect(output.logLevel).toBe("DEBUG");
    expect(output.generationIntervalMs).toBe(600000);
  });

  it("enables Leva only when explicitly opted in on localhost", () => {
    const result = runEnvScript(
      `
      globalThis.window = { location: { origin: "http://localhost:8787" } };
      const envModule = await import("./src/env.ts");
      console.log(JSON.stringify({
        isLevaEnabled: envModule.isLevaEnabled(),
        levaFlag: envModule.publicEnv.NEXT_PUBLIC_ENABLE_LEVA,
      }));
    `,
      {
        NEXT_PUBLIC_ENABLE_LEVA: "true",
      },
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      isLevaEnabled: boolean;
      levaFlag: string;
    };

    expect(output.levaFlag).toBe("true");
    expect(output.isLevaEnabled).toBe(true);
  });

  it("keeps Leva disabled outside localhost even if the flag is enabled", () => {
    const result = runEnvScript(
      `
      globalThis.window = { location: { origin: "https://doomindex.fun" } };
      const envModule = await import("./src/env.ts");
      console.log(JSON.stringify({
        isDevelopment: envModule.isDevelopment(),
        isLevaEnabled: envModule.isLevaEnabled(),
      }));
    `,
      {
        NEXT_PUBLIC_BASE_URL: "https://doomindex.fun",
        NEXT_PUBLIC_ENABLE_LEVA: "true",
      },
    );

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      isDevelopment: boolean;
      isLevaEnabled: boolean;
    };

    expect(output.isDevelopment).toBe(false);
    expect(output.isLevaEnabled).toBe(false);
  });

  it("keeps client-safe modules usable when server-only variables are absent", () => {
    const result = runEnvScript(`
      globalThis.window = { location: { origin: "http://localhost:8787" } };
      const constants = await import("./src/constants/index.ts");
      const { logger } = await import("./src/utils/logger.ts");
      const { getBaseUrl } = await import("./src/utils/url.ts");
      console.log(JSON.stringify({
        generationIntervalMs: constants.GENERATION_INTERVAL_MS,
        currentLogLevel: logger.getCurrentLevel(),
        baseUrl: getBaseUrl(),
      }));
    `);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      baseUrl: string;
      currentLogLevel: string;
      generationIntervalMs: number;
    };

    expect(output.generationIntervalMs).toBe(600000);
    expect(output.currentLogLevel).toBe("DEBUG");
    expect(output.baseUrl).toBe("http://localhost:8787");
  });
});
