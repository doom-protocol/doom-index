import { describe, it, expect, mock, beforeEach } from "bun:test";
import { viewerRouter } from "@/server/trpc/routers/viewer";
import { createMockContext } from "../helpers";
import { ok, err } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { TRPCError } from "@trpc/server";

describe("Viewer Router", () => {
  beforeEach(() => {
    mock.restore();
  });

  describe("register", () => {
    it("should register viewer successfully", async () => {
      const mockKvNamespace = {} as KVNamespace;

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => ok(undefined),
          removeViewer: async () => ok(undefined),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      const result = await caller.register({
        sessionId: "test-session-id",
      });

      expect(result.success).toBe(true);
    });

    it("should reject bot user agent from headers", async () => {
      const mockKvNamespace = {} as KVNamespace;

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
        headers: new Headers({
          "user-agent": "Googlebot",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.register({
          sessionId: "test-session-id",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
        }
      }
    });

    it("should reject bot user agent from input", async () => {
      const mockKvNamespace = {} as KVNamespace;

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.register({
          sessionId: "test-session-id",
          userAgent: "Googlebot",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
        }
      }
    });

    it("should throw error when KV is not configured", async () => {
      const ctx = createMockContext({
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.register({
          sessionId: "test-session-id",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });

    it("should throw error when service fails", async () => {
      const mockKvNamespace = {} as KVNamespace;
      const serviceError: AppError = {
        type: "StorageError",
        op: "put",
        key: "viewer:test-session-id",
        message: "KV error",
      };

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => err(serviceError),
          removeViewer: async () => ok(undefined),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.register({
          sessionId: "test-session-id",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });

    it("should reject empty sessionId", async () => {
      const mockKvNamespace = {} as KVNamespace;

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
        headers: new Headers({
          "user-agent": "Mozilla/5.0",
        }),
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.register({
          sessionId: "",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("remove", () => {
    it("should remove viewer successfully", async () => {
      const mockKvNamespace = {} as KVNamespace;

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => ok(undefined),
          removeViewer: async () => ok(undefined),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
      });

      const caller = viewerRouter.createCaller(ctx);

      const result = await caller.remove({
        sessionId: "test-session-id",
      });

      expect(result.success).toBe(true);
    });

    it("should throw error when KV is not configured", async () => {
      const ctx = createMockContext();

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.remove({
          sessionId: "test-session-id",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });

    it("should throw error when service fails", async () => {
      const mockKvNamespace = {} as KVNamespace;
      const serviceError: AppError = {
        type: "StorageError",
        op: "delete",
        key: "viewer:test-session-id",
        message: "KV error",
      };

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => ok(undefined),
          removeViewer: async () => err(serviceError),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.remove({
          sessionId: "test-session-id",
        });
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });
  });

  describe("activeCount", () => {
    it("should return active viewer count successfully", async () => {
      const mockKvNamespace = {} as KVNamespace;

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => ok(undefined),
          removeViewer: async () => ok(undefined),
          countActiveViewers: async () => ok(42),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
      });

      const caller = viewerRouter.createCaller(ctx);

      const result = await caller.activeCount();

      expect(result.count).toBe(42);
      expect(result.ttlSeconds).toBe(60);
    });

    it("should throw error when KV is not configured", async () => {
      const ctx = createMockContext();

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.activeCount();
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });

    it("should throw error when service fails", async () => {
      const mockKvNamespace = {} as KVNamespace;
      const serviceError: AppError = {
        type: "StorageError",
        op: "list",
        key: "viewer:",
        message: "KV error",
      };

      mock.module("@/services/viewer", () => ({
        createViewerService: () => ({
          registerViewer: async () => ok(undefined),
          removeViewer: async () => ok(undefined),
          countActiveViewers: async () => err(serviceError),
        }),
      }));

      const ctx = createMockContext({
        kvNamespace: mockKvNamespace,
      });

      const caller = viewerRouter.createCaller(ctx);

      try {
        await caller.activeCount();
        throw new Error("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("INTERNAL_SERVER_ERROR");
        }
      }
    });
  });
});
