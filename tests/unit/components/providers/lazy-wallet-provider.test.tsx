import { describe, expect, it } from "bun:test";

describe("unit/components/providers/lazy-wallet-provider", () => {
  it("renders without importing the Umi provider", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { render } from "@testing-library/react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          mock.module("@/components/providers/umi-provider", () => {
            throw new Error("lazy wallet provider must not import the Umi provider");
          });

          mock.module("@/components/providers/wallet-adapter-provider", async () => {
            await Promise.resolve();
            return {
              WalletAdapterProvider: ({ children }) => children,
            };
          });

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/components/providers/lazy-wallet-provider.tsx"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { LazyWalletProvider } = await import(moduleUrl.href);
          const { getByText } = render(
            LazyWalletProvider({
              children: "mint child",
            }),
          );

          console.log(JSON.stringify({ found: Boolean(getByText("mint child")) }));
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
    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as { found: boolean };
    expect(output.found).toBe(true);
  });

  it("installs the browser Buffer polyfill before rendering the wallet adapter subtree", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { render } from "@testing-library/react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          delete globalThis.Buffer;

          mock.module("@/components/providers/wallet-adapter-provider", async () => {
            await Promise.resolve();
            return {
              WalletAdapterProvider: ({ children }) => children,
            };
          });

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/components/providers/lazy-wallet-provider.tsx"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { LazyWalletProvider } = await import(moduleUrl.href);
          render(
            LazyWalletProvider({
              children: "mint child",
            }),
          );

          console.log(
            JSON.stringify({
              hasBuffer: typeof globalThis.Buffer === "function",
            }),
          );
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
    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as { hasBuffer: boolean };
    expect(output.hasBuffer).toBe(true);
  });
});
