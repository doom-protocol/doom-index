import { listR2Objects } from "@/lib/r2";
import { describe, expect, it } from "bun:test";

describe("listR2Objects", () => {
  it("forwards options with clamped limit", async () => {
    let receivedOptions: R2ListOptions | undefined;
    const bucket = {
      async list(options?: R2ListOptions): Promise<R2Objects> {
        receivedOptions = options;
        return {
          objects: [],
          delimitedPrefixes: [],
          truncated: false,
        };
      },
    } as unknown as R2Bucket;

    const result = await listR2Objects(bucket, {
      limit: 5000,
      prefix: "images/",
      cursor: "cursor-key",
      startAfter: "start-after-key",
      delimiter: "/",
      include: ["httpMetadata"],
    });

    expect(result.isOk()).toBe(true);
    expect(receivedOptions).toEqual({
      limit: 1000,
      prefix: "images/",
      cursor: "cursor-key",
      startAfter: "start-after-key",
      delimiter: "/",
      include: ["httpMetadata"],
    });
  });

  it("returns err when bucket.list throws", async () => {
    const bucket = {
      async list(): Promise<R2Objects> {
        throw new Error("boom");
      },
    } as unknown as R2Bucket;

    const result = await listR2Objects(bucket, { prefix: "images/" });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("StorageError");
    }
  });
});
