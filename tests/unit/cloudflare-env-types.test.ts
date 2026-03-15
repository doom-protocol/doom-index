import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("unit/cloudflare-env-types", () => {
  it("reads generated env types from src/types/cloudflare-env.d.ts", () => {
    const cloudflareEnvTypes = readFileSync(join(process.cwd(), "src", "types", "cloudflare-env.d.ts"), "utf8");

    expect(cloudflareEnvTypes).not.toContain("NEXT_PUBLIC_R2_URL");
    expect(cloudflareEnvTypes).toContain('mainModule: typeof import("../worker");');
  });

  it("keeps Wrangler pointed at src/worker.ts", () => {
    const wranglerConfig = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");

    expect(wranglerConfig).toContain('"main": "src/worker.ts"');
  });
});
