import { describe, expect, it } from "bun:test";

import { loadPublicAsset } from "@/server/services/paintings/asset-loader";

describe("unit/server/services/paintings/asset-loader", () => {
  it("rejects local public asset traversal paths", async () => {
    const result = await loadPublicAsset({ path: "/../secrets.txt" });

    expect(result.isErr()).toBe(true);
    if (result.isOk()) {
      throw new Error("Expected traversal path to be rejected");
    }

    expect(result.error.type).toBe("StorageError");
    expect(result.error.message).toContain("outside the public directory");
  });
});
