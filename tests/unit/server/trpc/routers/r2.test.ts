import { r2Router } from "@/server/trpc/routers/r2";
import type { AppError } from "@/types/app-error";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { err, ok } from "neverthrow";
import { createMockContext } from "../helpers";

describe("R2 Router", () => {
  beforeEach(() => {
    mock.restore();
    // Mock getCloudflareContext
    void mock.module("@opennextjs/cloudflare", () => ({
      getCloudflareContext: mock(() =>
        Promise.resolve({
          env: {
            R2_BUCKET: {} as R2Bucket,
          } as unknown as Cloudflare.Env,
        }),
      ),
    }));
    // Mock env.ts
    void mock.module("@/env", () => ({
      env: {
        R2_PUBLIC_DOMAIN: undefined,
        NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
      },
    }));
  });

  it("should return JSON data for getJson", async () => {
    const mockData = { test: "data" };
    void mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () =>
        ok({
          get: async () =>
            await Promise.resolve({
              text: async () => await Promise.resolve(JSON.stringify(mockData)),
            }),
        } as unknown as R2Bucket),
      getJsonR2: async () => await Promise.resolve(ok(mockData)),
    }));

    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    const result = await caller.getJson({
      key: ["state", "global.json"],
    });

    expect(result).toEqual(mockData);
  });

  it("should normalize key path correctly for getJson", async () => {
    void mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () =>
        ok({
          get: () =>
            Promise.resolve({
              text: () => Promise.resolve(JSON.stringify({})),
            }),
        } as unknown as R2Bucket),
      getJsonR2: async () => await Promise.resolve(ok({})),
    }));

    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    const result = await caller.getJson({
      key: ["/state/", "/global.json/"],
    });

    expect(result).toBeDefined();
  });

  it("should reject empty key array for getJson", async () => {
    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    try {
      await caller.getJson({
        key: [],
      });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should reject invalid key (empty after normalization) for getJson", async () => {
    void mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => ok({} as R2Bucket),
    }));

    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    try {
      await caller.getJson({
        key: ["", "", ""],
      });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) {
        expect(error.code).toBe("BAD_REQUEST");
      }
    }
  });

  it("should throw error when R2 bucket resolution fails for getJson", async () => {
    const bucketError: AppError = {
      type: "InternalError",
      message: "R2_BUCKET binding is not configured",
    };

    void mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () => err(bucketError),
    }));

    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    try {
      await caller.getJson({
        key: ["path", "to", "object"],
      });
      throw new Error("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      if (error instanceof TRPCError) {
        expect(error.code).toBe("INTERNAL_SERVER_ERROR");
      }
    }
  });

  it("should return null when object not found for getJson", async () => {
    void mock.module("@/lib/r2", () => ({
      resolveR2Bucket: () =>
        ok({
          get: async () => await Promise.resolve(null),
        } as unknown as R2Bucket),
      getJsonR2: async () => await Promise.resolve(ok(null)),
    }));

    const ctx = createMockContext();
    const caller = r2Router.createCaller(ctx);

    const result = await caller.getJson({
      key: ["path", "to", "object"],
    });

    expect(result).toBeNull();
  });
});
