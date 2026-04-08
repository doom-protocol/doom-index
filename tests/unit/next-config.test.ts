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

async function loadNextConfig() {
  process.env.npm_lifecycle_event = "dev";
  void mock.module("@opennextjs/cloudflare", () => ({
    getCloudflareContext: async () => Promise.resolve({ env: {} }),
    initOpenNextCloudflareForDev: () => undefined,
  }));
  const modulePath = `@/../next.config.ts?cacheBust=${String(Date.now())}`;
  const importedConfig = (await import(modulePath)) as {
    default: {
      images?: NextConfigImageSettings;
    };
  };

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

  it("uses the Cloudflare custom image loader and permits the archive gateway hosts", async () => {
    const config = await loadNextConfig();
    const images = config.images ?? {};
    const hasPermagatePattern = images.remotePatterns?.some(
      (pattern) => pattern.protocol === "https" && pattern.hostname === "permagate.io",
    );
    const hasArweaveNetPattern = images.remotePatterns?.some(
      (pattern) => pattern.protocol === "https" && pattern.hostname === "arweave.net",
    );

    expect(images.loader).toBe("custom");
    expect(images.loaderFile).toBe("./src/lib/image-loader.ts");
    expect(hasPermagatePattern).toBe(true);
    expect(hasArweaveNetPattern).toBe(true);
  });
});
