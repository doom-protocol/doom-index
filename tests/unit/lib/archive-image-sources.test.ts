import { getArchiveImageSources } from "@/lib/archive-image-sources";
import { describe, expect, it } from "bun:test";

describe("archive image sources", () => {
  it("builds transformed archive sources across fallback gateways in production", () => {
    expect(
      getArchiveImageSources("https://permagate.io/painting-1", {
        baseUrl: "https://doomindex.fun",
      }),
    ).toEqual([
      "/cdn-cgi/image/width=320,quality=70,fit=cover,format=auto/https://permagate.io/painting-1",
      "/cdn-cgi/image/width=320,quality=70,fit=cover,format=auto/https://arweave.net/painting-1",
    ]);
  });
});
