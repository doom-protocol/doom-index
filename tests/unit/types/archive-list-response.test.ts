import type { ArchiveListResponse } from "@/types/archive-list-response";
import { describe, expect, it } from "bun:test";

describe("unit/types/archive-list-response", () => {
  it("loads the shared archive list response module", async () => {
    const archiveListResponseModule = await import("@/types/archive-list-response");

    expect(archiveListResponseModule).toBeDefined();
  });

  it("accepts archive list responses used by client hooks", () => {
    const response: ArchiveListResponse = {
      items: [],
      hasMore: false,
    };

    expect(response.cursor).toBeUndefined();
    expect(response.items).toHaveLength(0);
  });
});
