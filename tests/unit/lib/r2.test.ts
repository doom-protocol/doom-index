import { describe, expect, it, mock } from "bun:test";

let cloudflareEnv: { R2_BUCKET?: R2Bucket } = {};

void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: (options?: {
    async?: boolean;
  }): Promise<{ env: typeof cloudflareEnv }> | { env: typeof cloudflareEnv } =>
    options?.async ? Promise.resolve({ env: cloudflareEnv }) : { env: cloudflareEnv },
}));

describe("resolveR2Bucket", () => {
  it("returns an error when the R2 binding is missing", async () => {
    cloudflareEnv = {};

    const { resolveR2Bucket } = await import("@/lib/r2");
    const result = resolveR2Bucket();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("R2_BUCKET binding is not configured on Cloudflare environment");
    }
  });
});

describe("resolveR2BucketAsync", () => {
  it("returns an error when the R2 binding is missing", async () => {
    cloudflareEnv = {};

    const { resolveR2BucketAsync } = await import("@/lib/r2");
    const result = await resolveR2BucketAsync();

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("R2_BUCKET binding is not configured on Cloudflare environment");
    }
  });
});
