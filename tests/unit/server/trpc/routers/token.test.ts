import { describe, it, expect, mock, beforeEach } from "bun:test";
import { tokenRouter } from "@/server/trpc/routers/token";
import { createMockContext } from "../helpers";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { TRPCError } from "@trpc/server";
import type { TokenState } from "@/types/domain";

describe("Token Router", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("should return token state successfully", async () => {
    const mockTokenState: TokenState = {
      ticker: "CO2",
      thumbnailUrl: "https://example.com/image.webp",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => ok({} as R2Bucket),
      getJsonR2: async () => ok(mockTokenState),
    }));

    const ctx = createMockContext();
    const caller = tokenRouter.createCaller(ctx);

    const result = await caller.getState({ ticker: "CO2" });

    expect(result).toEqual(mockTokenState);
  });

  it("should return null when token state does not exist", async () => {
    mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => ok({} as R2Bucket),
      getJsonR2: async () => ok(null),
    }));

    const ctx = createMockContext();
    const caller = tokenRouter.createCaller(ctx);

    const result = await caller.getState({ ticker: "CO2" });

    expect(result).toBeNull();
  });

  it("should reject invalid ticker", async () => {
    const ctx = createMockContext();
    const caller = tokenRouter.createCaller(ctx);

    try {
      await caller.getState({ ticker: "INVALID" as unknown as "CO2" });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should throw error when R2 bucket resolution fails", async () => {
    const bucketError: AppError = {
      type: "InternalError",
      message: "R2_BUCKET binding is not configured",
    };

    mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => err(bucketError),
      getJsonR2: async () => ok(null),
    }));

    const ctx = createMockContext();
    const caller = tokenRouter.createCaller(ctx);

    try {
      await caller.getState({ ticker: "CO2" });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) {
        expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      }
    }
  });

  it("should throw error when R2 get fails", async () => {
    const r2Error: AppError = {
      type: "StorageError",
      op: "get",
      key: "state/CO2.json",
      message: "R2 JSON get failed",
    };

    mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => ok({} as R2Bucket),
      getJsonR2: async () => err(r2Error),
    }));

    const ctx = createMockContext();
    const caller = tokenRouter.createCaller(ctx);

    try {
      await caller.getState({ ticker: "CO2" });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) {
        expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      }
    }
  });
});
