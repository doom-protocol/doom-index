import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

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
  const modulePath = `@/../next.config.ts?cacheBust=${String(Date.now())}`;
  const importedConfig = (await import(modulePath)) as {
    default: {
      typedRoutes?: boolean;
      images?: NextConfigImageSettings;
    };
  };

  return importedConfig.default;
}

describe("next.config", () => {
  beforeEach(() => {
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it("uses the standard next/image optimizer and permits the archive gateway hosts", async () => {
    const config = await loadNextConfig();
    const images = config.images ?? {};
    const hasPermagatePattern = images.remotePatterns?.some(
      (pattern) => pattern.protocol === "https" && pattern.hostname === "permagate.io",
    );
    const hasArweaveNetPattern = images.remotePatterns?.some(
      (pattern) => pattern.protocol === "https" && pattern.hostname === "arweave.net",
    );

    expect(images.loader).toBeUndefined();
    expect(images.loaderFile).toBeUndefined();
    expect(hasPermagatePattern).toBe(true);
    expect(hasArweaveNetPattern).toBe(true);
    expect(config.typedRoutes).toBeUndefined();
  });
});
