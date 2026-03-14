import { describe, expect, it } from "bun:test";

describe("unit/app/page", () => {
  it("loads the home page module without importing an app-local home client", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          mock.module("@/app/home-page-content", () => {
            throw new Error("home page must not import an app-local home client");
          });

          mock.module("@/components/gallery/gallery-scene", () => {
            throw new Error("home page must not import gallery scene directly");
          });

          mock.module("@/components/home/home-view", () => ({
            HomeView: () => null,
          }));

          mock.module("@/components/ui/header", () => ({
            Header: () => null,
          }));

          mock.module("@/server/trpc/server-caller", () => ({
            createStaticServerCaller: async () => ({
              paintings: {
                list: async () => ({
                  items: [],
                }),
              },
            }),
          }));

          mock.module("@/utils/logger", () => ({
            logger: {
              warn: () => {},
            },
          }));

          mock.module("next/dynamic", () => ({
            default: () => () => null,
          }));

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/app/page.tsx"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          await import(moduleUrl.href);

          console.log(JSON.stringify({ ok: true }));
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
    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as { ok: boolean };
    expect(output.ok).toBe(true);
  });
});
