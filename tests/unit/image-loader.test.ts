import { afterEach, beforeEach, describe, expect, it } from "bun:test";

const originalNodeEnv = process.env.NODE_ENV;
const writableProcessEnv = process.env as Record<string, string | undefined>;

async function loadImageLoader() {
  const modulePath = `../../src/lib/image-loader.ts?cacheBust=${String(Date.now())}`;
  const importedModule = (await import(modulePath)) as {
    default: (params: { quality?: number; src: string; width: number }) => string;
  };

  return importedModule.default;
}

describe("image-loader", () => {
  beforeEach(() => {
    writableProcessEnv.NODE_ENV = "production";
  });

  afterEach(() => {
    writableProcessEnv.NODE_ENV = originalNodeEnv;
  });

  it("builds a Cloudflare image transform URL for remote origins", async () => {
    const imageLoader = await loadImageLoader();

    expect(
      imageLoader({
        src: "https://permagate.io/painting-1",
        width: 320,
        quality: 70,
      }),
    ).toBe("/cdn-cgi/image/width=320,quality=70/https://permagate.io/painting-1");
  });

  it("builds a Cloudflare image transform URL for local paths", async () => {
    const imageLoader = await loadImageLoader();

    expect(
      imageLoader({
        src: "/images/archive/painting-1.webp",
        width: 320,
        quality: 70,
      }),
    ).toBe("/cdn-cgi/image/width=320,quality=70/images/archive/painting-1.webp");
  });

  it("returns the original src during development", async () => {
    writableProcessEnv.NODE_ENV = "development";
    const imageLoader = await loadImageLoader();

    expect(
      imageLoader({
        src: "https://permagate.io/painting-1",
        width: 320,
        quality: 70,
      }),
    ).toBe("https://permagate.io/painting-1");
  });
});
