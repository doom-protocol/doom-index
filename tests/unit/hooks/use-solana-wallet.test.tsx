import { describe, expect, it } from "bun:test";

const runUseSolanaWalletScript = (connectImplementation: string) => {
  return Bun.spawnSync({
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

        const loggerCalls = { debug: [], error: [] };
        const connectMock = mock(${connectImplementation});
        const disconnectMock = mock(async () => {
          await Promise.resolve();
        });

        const walletState = {
          connect: connectMock,
          connected: false,
          connecting: false,
          disconnect: disconnectMock,
          publicKey: null,
          wallet: {
            adapter: {
              name: "Phantom",
            },
          },
        };

        mock.module("@solana/wallet-adapter-react", () => ({
          useWallet: () => walletState,
        }));

        mock.module("@/utils/logger", () => ({
          logger: {
            debug: (...args) => {
              loggerCalls.debug.push(args);
            },
            error: (...args) => {
              loggerCalls.error.push(args);
            },
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

        console.log(JSON.stringify(loggerCalls));
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
};

describe("unit/hooks/use-solana-wallet", () => {
  it("logs adapter state before and after wallet.connect succeeds", () => {
    const result = runUseSolanaWalletScript(`
      async () => {
        await Promise.resolve();
      }
    `);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      debug: Array<[string, Record<string, unknown>]>;
      error: Array<[string, Record<string, unknown>]>;
    };

    expect(
      output.debug.some(
        ([eventName, payload]) =>
          eventName === "wallet.connection.adapter-connect.start" &&
          payload.connected === false &&
          payload.connecting === false &&
          payload.publicKey === null &&
          payload.walletName === "Phantom",
      ),
    ).toBe(true);
    expect(
      output.debug.some(
        ([eventName, payload]) =>
          eventName === "wallet.connection.adapter-connect.success" &&
          payload.connected === false &&
          payload.connecting === false &&
          payload.publicKey === null &&
          payload.walletName === "Phantom",
      ),
    ).toBe(true);
  });

  it("logs adapter state when wallet.connect fails", () => {
    const result = runUseSolanaWalletScript(`
      async () => {
        await Promise.resolve();
        throw new Error("wallet boom");
      }
    `);

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      debug: Array<[string, Record<string, unknown>]>;
      error: Array<[string, Record<string, unknown>]>;
    };

    expect(
      output.error.some(
        ([eventName, payload]) =>
          eventName === "wallet.connection.failed" &&
          payload.connected === false &&
          payload.connecting === false &&
          payload.error === "wallet boom" &&
          payload.errorType === "connection_failed" &&
          payload.publicKey === null &&
          payload.walletName === "Phantom",
      ),
    ).toBe(true);
  });
});
