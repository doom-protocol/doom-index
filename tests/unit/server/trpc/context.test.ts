import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

type TrpcContextModule = typeof import("@/server/trpc/context");

function mockCloudflareContextUnavailable() {
  void mock.module("@/lib/cloudflare-context", () => ({
    resolveCloudflareEnv: async () => Promise.resolve(undefined),
  }));
}

async function importTrpcContextModule(): Promise<TrpcContextModule> {
  mock.restore();
  mockCloudflareContextUnavailable();
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/server/trpc/context.ts"));
  moduleUrl.searchParams.set("test", `${String(Date.now())}-${String(Math.random())}`);
  return (await import(moduleUrl.href)) as TrpcContextModule;
}

describe("Context Creator", () => {
  beforeEach(() => {
    mock.restore();
    mockCloudflareContextUnavailable();
  });

  afterEach(() => {
    mock.restore();
  });

  it("should create context with headers", async () => {
    const { createContext: makeTrpcContext } = await importTrpcContextModule();
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

    const result = await makeTrpcContext(opts);

    expect(result.headers).toBeDefined();
    expect(result.logger).toBeDefined();
    expect(result.headers.get("user-agent")).toBe("test-agent");
  });

  it("should handle Cloudflare context unavailable gracefully", async () => {
    const { createContext: makeTrpcContext } = await importTrpcContextModule();
    const mockReq = new Request("http://localhost");
    const opts: FetchCreateContextFnOptions = {
      req: mockReq,
      resHeaders: new Headers(),
      info: {} as unknown as FetchCreateContextFnOptions["info"],
    };

    const result = await makeTrpcContext(opts);

    expect(result.headers).toBeDefined();
    expect(result.logger).toBeDefined();
    expect(result.kvNamespace).toBeUndefined();
  });

  it("should create static server context without request headers", async () => {
    const { createStaticServerContext } = await importTrpcContextModule();
    const result = await createStaticServerContext();

    expect(result.headers).toBeDefined();
    expect(result.headers.get("user-agent")).toBeNull();
    expect(result.logger).toBeDefined();
    expect(result.kvNamespace).toBeUndefined();
  });
});
