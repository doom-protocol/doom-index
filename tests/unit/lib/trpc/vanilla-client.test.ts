import { describe, expect, it } from "bun:test";

describe("unit/lib/trpc/vanilla-client", () => {
  it("does not touch the shared base-url helper when a worker passes an explicit baseUrl", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          mock.module("@/utils/url", () => {
            throw new Error("vanilla-client should not import getBaseUrl when baseUrl is provided");
          });

          mock.module("@/server/trpc/routers/_app", () => ({}));

          mock.module("@trpc/client", () => ({
            createTRPCClient: (config) => config,
            httpBatchLink: (options) => ({ kind: "batch", options }),
            httpSubscriptionLink: (options) => ({ kind: "subscription", options }),
            splitLink: (options) => options.false,
          }));

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/trpc/vanilla-client.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { createVanillaTRPCClient } = await import(moduleUrl.href);
          const client = createVanillaTRPCClient({ baseUrl: "http://localhost:8787" });

          console.log(JSON.stringify({
            hasLinks: Array.isArray(client.links),
            url: client.links[0]?.options?.url ?? null,
          }));
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      hasLinks: boolean;
      url: string | null;
    };

    expect(output.hasLinks).toBe(true);
    expect(output.url).toBe("http://localhost:8787/api/trpc");
  });
});
