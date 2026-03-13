import { describe, expect, it } from "bun:test";

const runSolanaConfigScript = (envOverrides: Record<string, string | undefined>) => {
  const env = { ...process.env };
  env.NEXT_PUBLIC_BASE_URL = "http://localhost:8787";
  env.NEXT_PUBLIC_GENERATION_INTERVAL_MS = "600000";
  env.LOG_LEVEL = "DEBUG";

  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(env, key);
      continue;
    }

    env[key] = value;
  }

  return Bun.spawnSync({
    cmd: [
      "bun",
      "--eval",
      `
        const { getSolanaConnectionConfig } = await import("./src/constants/solana.ts");
        console.log(JSON.stringify(getSolanaConnectionConfig()));
      `,
    ],
    cwd: process.cwd(),
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
};

describe("unit/constants/solana", () => {
  it("derives a mainnet adapter network from a custom mainnet RPC URL", () => {
    const result = runSolanaConfigScript({
      NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
      NEXT_PUBLIC_SOLANA_NETWORK: undefined,
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      endpoint: string;
      network: string;
    };

    expect(output).toEqual({
      endpoint: "https://api.mainnet-beta.solana.com",
      network: "mainnet",
    });
  });

  it("falls back to the configured network when a custom RPC URL cannot be inferred", () => {
    const result = runSolanaConfigScript({
      NEXT_PUBLIC_SOLANA_RPC_URL: "https://rpc.example.com/solana",
      NEXT_PUBLIC_SOLANA_NETWORK: "testnet",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      endpoint: string;
      network: string;
    };

    expect(output).toEqual({
      endpoint: "https://rpc.example.com/solana",
      network: "testnet",
    });
  });
});
