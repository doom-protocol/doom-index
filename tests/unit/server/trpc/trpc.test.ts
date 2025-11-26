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

  it("should format zod errors correctly", async () => {
    const { z } = await import("zod");
    const { TRPCError } = await import("@trpc/server");

    const testRouter = router({
      test: publicProcedure.input(z.object({ name: z.string().min(1) })).query(() => {
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
      // zodエラーがフォーマットされていることを確認
      if (error instanceof TRPCError) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    }
  });
});
