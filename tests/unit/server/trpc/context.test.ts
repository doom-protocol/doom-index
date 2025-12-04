import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Mock must be set up before importing createContext so getCloudflareContext
// is replaced when the module is evaluated
void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    throw new Error("Cloudflare context not available");
  },
}));

import { createContext } from "@/server/trpc/context";

describe("Context Creator", () => {
  beforeEach(() => {
    // Cloudflare contextのモックをリセット
  });

  afterEach(() => {
    mock.restore();
  });

  it("should create context with headers", async () => {
    const mockReq = new Request("http://localhost", {
      headers: {
        "user-agent": "test-agent",
      },
    });

    const opts: FetchCreateContextFnOptions = {
      req: mockReq,
      resHeaders: new Headers(),
      info: {} as unknown as FetchCreateContextFnOptions["info"],
    };

    const context = await createContext(opts);

    expect(context.headers).toBeDefined();
    expect(context.logger).toBeDefined();
    expect(context.headers.get("user-agent")).toBe("test-agent");
  });

  it("should handle Cloudflare context unavailable gracefully", async () => {
    const mockReq = new Request("http://localhost");
    const opts: FetchCreateContextFnOptions = {
      req: mockReq,
      resHeaders: new Headers(),
      info: {} as unknown as FetchCreateContextFnOptions["info"],
    };

    const context = await createContext(opts);

    expect(context.headers).toBeDefined();
    expect(context.logger).toBeDefined();
    expect(context.kvNamespace).toBeUndefined();
    expect(context.r2Bucket).toBeUndefined();
  });
});
