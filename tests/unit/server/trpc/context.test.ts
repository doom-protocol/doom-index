import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { createContext, createStaticServerContext } from "@/server/trpc/context";

// Mock must be set up before importing createContext so getCloudflareContext
// is replaced when the module is evaluated
void mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    throw new Error("Cloudflare context not available");
  },
}));

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

    const TestAppContext = await createContext(opts);

    expect(TestAppContext.headers).toBeDefined();
    expect(TestAppContext.logger).toBeDefined();
    expect(TestAppContext.headers.get("user-agent")).toBe("test-agent");
  });

  it("should handle Cloudflare context unavailable gracefully", async () => {
    const mockReq = new Request("http://localhost");
    const opts: FetchCreateContextFnOptions = {
      req: mockReq,
      resHeaders: new Headers(),
      info: {} as unknown as FetchCreateContextFnOptions["info"],
    };

    const TestAppContext = await createContext(opts);

    expect(TestAppContext.headers).toBeDefined();
    expect(TestAppContext.logger).toBeDefined();
    expect(TestAppContext.kvNamespace).toBeUndefined();
  });

  it("should create static server context without request headers", async () => {
    const testAppContext = await createStaticServerContext();

    expect(testAppContext.headers).toBeDefined();
    expect(testAppContext.headers.get("user-agent")).toBeNull();
    expect(testAppContext.logger).toBeDefined();
    expect(testAppContext.kvNamespace).toBeUndefined();
  });
});
