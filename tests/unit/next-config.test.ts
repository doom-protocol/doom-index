import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const originalLifecycleEvent = process.env.npm_lifecycle_event;

interface NextConfigImageSettings {
  loader?: string;
  loaderFile?: string;
  remotePatterns?: Array<{
    protocol?: string;
    hostname?: string;
    pathname?: string;
  }>;
}

interface NextConfigUnderTest {
  images?: NextConfigImageSettings;
  serverExternalPackages?: string[];
  turbopack?: {
    resolveAlias?: Record<string, string>;
  };
  webpack?: unknown;
}

async function loadNextConfig(options?: { lifecycleEvent?: string }) {
  process.env.npm_lifecycle_event = options?.lifecycleEvent ?? "dev";
  void mock.module("@opennextjs/cloudflare", () => ({
    getCloudflareContext: async () => Promise.resolve({ env: {} }),
    initOpenNextCloudflareForDev: () => undefined,
  }));
  const modulePath = `@/../next.config.ts?cacheBust=${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
  const importedConfig = (await import(modulePath)) as { default: NextConfigUnderTest };

  return importedConfig.default;
}

describe("next.config", () => {
  beforeEach(() => {
    mock.restore();
    process.env.npm_lifecycle_event = "dev";
  });

  afterEach(() => {
    mock.restore();
    if (originalLifecycleEvent === undefined) {
      delete process.env.npm_lifecycle_event;
      return;
    }

    process.env.npm_lifecycle_event = originalLifecycleEvent;
  });

  it("uses the standard next/image optimizer and permits permagate.io", async () => {
    const config = await loadNextConfig();
    const images = config.images ?? {};
    const hasPermagatePattern = images.remotePatterns?.some(
      (pattern) => pattern.protocol === "https" && pattern.hostname === "permagate.io",
    );

    expect(images.loader).toBeUndefined();
    expect(images.loaderFile).toBeUndefined();
    expect(hasPermagatePattern).toBe(true);
  });

  it("externalizes client-only packages from server bundle via serverExternalPackages", async () => {
    const config = await loadNextConfig({ lifecycleEvent: "build:cf" });

    expect(config.serverExternalPackages).toContain("three");
    expect(config.serverExternalPackages).toContain("@solana/web3.js");
    expect(config.serverExternalPackages).toContain("@metaplex-foundation/umi");
  });

  it("turbopack resolveAlias handles wallet adapter CSS", async () => {
    const config = await loadNextConfig();
    const aliases = config.turbopack?.resolveAlias ?? {};

    expect(aliases["@solana/wallet-adapter-react-ui/styles.css"]).toBeString();
    expect(aliases.three).toBeUndefined();
  });
});
