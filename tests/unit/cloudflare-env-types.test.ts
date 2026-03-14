import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("unit/cloudflare-env-types", () => {
  it("reads generated env types from src/types/cloudflare-env.d.ts", () => {
    const cloudflareEnvTypes = readFileSync(join(process.cwd(), "src", "types", "cloudflare-env.d.ts"), "utf8");

    expect(cloudflareEnvTypes).not.toContain("NEXT_PUBLIC_R2_URL");
  });
});
