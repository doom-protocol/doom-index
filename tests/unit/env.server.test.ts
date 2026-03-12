import { describe, expect, it } from "bun:test";

describe("unit/env.server", () => {
  it("validates server-only variables eagerly when the env module is imported on the server", () => {
    const env = { ...process.env };
    env.NEXT_PUBLIC_BASE_URL = "http://localhost:8787";
    env.NEXT_PUBLIC_GENERATION_INTERVAL_MS = "600000";
    env.LOG_LEVEL = "DEBUG";
    Reflect.deleteProperty(env, "RUNWARE_API_KEY");

    const result = Bun.spawnSync({
      cmd: ["bun", "--eval", 'await import("./src/env.ts");'],
      cwd: process.cwd(),
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toContain("RUNWARE_API_KEY");
  });
});
