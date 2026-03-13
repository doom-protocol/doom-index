import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("unit/cloudflare-env-types", () => {
  it("does not expose the removed NEXT_PUBLIC_R2_URL binding", () => {
    const cloudflareEnvTypes = readFileSync(join(process.cwd(), "cloudflare-env.d.ts"), "utf8");

    expect(cloudflareEnvTypes).not.toContain("NEXT_PUBLIC_R2_URL");
  });
});
