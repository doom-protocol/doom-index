import { describe, expect, it } from "bun:test";

describe("unit/hooks/use-solana-wallet-no-umi", () => {
  it("connects a wallet without requiring the Umi provider", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { act, renderHook } from "@testing-library/react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          const connectMock = mock(async () => {
            await Promise.resolve();
          });

          mock.module("@solana/wallet-adapter-react", () => ({
            useWallet: () => ({
              connect: connectMock,
              connected: false,
              connecting: false,
              disconnect: mock(async () => {
                await Promise.resolve();
              }),
              publicKey: null,
              wallet: {
                adapter: {
                  name: "Phantom",
                },
              },
            }),
          }));

          mock.module("@/utils/logger", () => ({
            logger: {
              debug: () => {},
              error: () => {},
              info: () => {},
              warn: () => {},
            },
          }));

          mock.module("sonner", () => ({
            toast: {
              error: () => {},
              info: () => {},
              success: () => {},
            },
          }));

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/hooks/use-solana-wallet.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { useSolanaWallet } = await import(moduleUrl.href);
          const { result } = renderHook(() => useSolanaWallet());

          await act(async () => {
            await result.current.connectWallet();
          });

          console.log(JSON.stringify({ calls: connectMock.mock.calls.length }));
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
    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as { calls: number };
    expect(output.calls).toBe(1);
  });
});
