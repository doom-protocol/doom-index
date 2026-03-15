import { describe, expect, it } from "bun:test";

describe("unit/lib/analytics", () => {
  it("does not call next third parties GA before the dataLayer exists", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          const calls = [];

          mock.module("@next/third-parties/google", () => ({
            sendGAEvent: (...args) => {
              calls.push(args);
            },
          }));

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/analytics.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { sendGAEvent } = await import(moduleUrl.href);

          sendGAEvent("mint_button_click");

          console.log(JSON.stringify(calls));
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

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as unknown[];
    expect(output).toHaveLength(0);
  });

  it("delegates to next third parties GA when the dataLayer exists", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          const calls = [];

          mock.module("@next/third-parties/google", () => ({
            sendGAEvent: (...args) => {
              calls.push(args);
            },
          }));

          window.dataLayer = [];

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/lib/analytics.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { sendGAEvent } = await import(moduleUrl.href);

          sendGAEvent("mint_button_click", {
            source: "mint-button",
          });

          console.log(JSON.stringify(calls));
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

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as Array<
      [string, string, Record<string, string>]
    >;
    expect(output).toHaveLength(1);
    expect(output[0]).toEqual([
      "event",
      "mint_button_click",
      {
        source: "mint-button",
      },
    ]);
  });
});
