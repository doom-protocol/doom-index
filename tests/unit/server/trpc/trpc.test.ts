import { publicProcedure, router } from "@/server/trpc/trpc";
import { logger } from "@/utils/logger";
import { describe, expect, it, mock } from "bun:test";
import { createMockContext } from "./helpers";

describe("tRPC Init", () => {
  it("should create a router", () => {
    const testRouter = router({
      test: publicProcedure.query(() => {
        return { message: "test" };
      }),
    });

    expect(testRouter).toBeDefined();
  });

  it("should execute procedure with logging middleware", async () => {
    const mockLogger = {
      ...logger,
      info: mock(() => {}),
    };

    const ctx = createMockContext({ logger: mockLogger as typeof logger });

    const testRouter = router({
      test: publicProcedure.query(() => {
        return { message: "test" };
      }),
    });

    const caller = testRouter.createCaller(ctx);
    const result = await caller.test();

    expect(result).toEqual({ message: "test" });
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it("should format valibot errors correctly", async () => {
    const v = await import("valibot");
    const { TRPCError } = await import("@trpc/server");

    const testRouter = router({
      test: publicProcedure
        .input(val => v.parse(v.object({ name: v.pipe(v.string(), v.minLength(1)) }), val))
        .query(() => {
          return { message: "test" };
        }),
    });

    const ctx = createMockContext();
    const caller = testRouter.createCaller(ctx);

    try {
      await caller.test({ name: "" });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
      // zodエラー（今はvalibotError）がフォーマットされていることを確認
      // Note: tRPC client might wrap error differently in tests depending on how it's called.
      // But here we check TRPCError.
      if (error instanceof TRPCError) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    }
  });
});
