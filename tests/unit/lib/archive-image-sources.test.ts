import { getArchiveImageSources } from "@/lib/archive-image-sources";
import { describe, expect, it } from "bun:test";

describe("archive image sources", () => {
  it("keeps external archive gateways as raw URLs in production", () => {
    expect(
      getArchiveImageSources("https://permagate.io/painting-1", {
        baseUrl: "https://doomindex.fun",
      }),
    ).toEqual(["https://permagate.io/painting-1", "https://arweave.net/painting-1"]);
  });

  it("still transforms local archive paths in production", () => {
    expect(
      getArchiveImageSources("/images/archive/painting-1.png", {
        baseUrl: "https://doomindex.fun",
      }),
    ).toEqual(["/cdn-cgi/image/width=320,quality=70,fit=cover,format=auto/images/archive/painting-1.png"]);
  });
});
