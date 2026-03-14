import { describe, expect, it } from "bun:test";

describe("unit/app/providers", () => {
  it("renders the shared app providers without importing the wallet provider stack", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { createElement } from "react";
          import { render } from "@testing-library/react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          mock.module("@/components/providers/lazy-wallet-provider", () => {
            throw new Error("app/providers must not import the wallet provider stack");
          });

          mock.module("@tanstack/react-query", async () => {
            await Promise.resolve();
            return {
              QueryClient: function MockQueryClient() {},
              QueryClientProvider: ({ children }) => children,
            };
          });

          mock.module("@/lib/trpc/client", async () => {
            await Promise.resolve();
            return {
              TRPCProvider: ({ children }) => children,
              createTRPCClientInstance: () => ({}),
            };
          });

          mock.module("@/hooks/use-viewer", async () => {
            await Promise.resolve();
            return {
              useViewer: () => {},
            };
          });

          mock.module("sonner", async () => {
            await Promise.resolve();
            return {
              Toaster: () => null,
            };
          });

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/app/providers.tsx"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { Providers } = await import(moduleUrl.href);
          const { getByText } = render(
            createElement(Providers, {
              children: createElement("div", null, "child content"),
            }),
          );

          console.log(JSON.stringify({ found: Boolean(getByText("child content")) }));
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
});
