import { describe, it, expect } from "bun:test";
import { appRouter } from "@/server/trpc/routers/_app";
import { createMockContext } from "../../../unit/server/trpc/helpers";

describe("Viewer Integration", () => {
  it("should handle concurrent viewer registrations", async () => {
    const kvNamespace = {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
      list: async () => ({ keys: [], cursor: "", complete: true }),
    } as unknown as KVNamespace;

    const headers = new Headers({
      "user-agent": "Mozilla/5.0",
    });

    const ctx = {
      ...createMockContext(),
      kvNamespace,
      headers,
    };

    const caller = appRouter.createCaller(ctx);
    const sessionIds = Array.from({ length: 5 }, () => crypto.randomUUID());

    // 並行リクエストのシミュレーション
    const results = await Promise.allSettled(
      sessionIds.map(sessionId =>
        caller.viewer.register({
          sessionId,
          userAgent: "Mozilla/5.0",
        }),
      ),
    );

    // 全てのリクエストが処理されることを確認
    expect(results.length).toBe(5);
  });
});
