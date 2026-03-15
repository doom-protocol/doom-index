import { describe, expect, it } from "bun:test";

describe("unit/hooks/use-viewer", () => {
  it("creates the viewer worker as a module worker", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { renderHook } from "@testing-library/react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          mock.module("@/utils/logger", () => ({
            logger: {
              debug: () => {},
              error: () => {},
              info: () => {},
              warn: () => {},
            },
          }));

          const workerCalls = [];

          class MockWorker {
            constructor(url, options) {
              workerCalls.push({
                options,
                url: String(url),
              });
            }

            addEventListener() {}
            removeEventListener() {}
            terminate() {}
          }

          globalThis.Worker = MockWorker;

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/hooks/use-viewer.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { useViewer } = await import(moduleUrl.href);

          renderHook(() => useViewer());

          await Promise.resolve();

          console.log(JSON.stringify(workerCalls));
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
        NEXT_PUBLIC_GENERATION_INTERVAL_MS: "600000",
        LOG_LEVEL: "DEBUG",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as Array<{
      options?: { type?: string };
      url: string;
    }>;

    expect(output).toHaveLength(1);
    expect(output[0]?.url.includes("viewer.worker.ts")).toBe(true);
    expect(output[0]?.options?.type).toBe("module");
  });
});
