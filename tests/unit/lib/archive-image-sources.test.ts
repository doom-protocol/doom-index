import { getArchiveImageSources } from "@/lib/archive-image-sources";
import { describe, expect, it } from "bun:test";

describe("archive image sources", () => {
  it("keeps external archive gateways as raw URLs in production", () => {
    expect(getArchiveImageSources("https://permagate.io/painting-1")).toEqual([
      "https://permagate.io/painting-1",
      "https://arweave.net/painting-1",
    ]);
  });

  it("keeps local archive paths raw so the custom image loader can transform them", () => {
    expect(getArchiveImageSources("/images/archive/painting-1.png")).toEqual(["/images/archive/painting-1.png"]);
  });

  it("keeps fallback gateway order deterministic when an allowlist is provided", () => {
    expect(
      getArchiveImageSources("https://permagate.io/painting-1", {
        fallbackGatewayBaseUrls: ["https://gateway.example", "https://arweave.net"],
      }),
    ).toEqual([
      "https://permagate.io/painting-1",
      "https://gateway.example/painting-1",
      "https://arweave.net/painting-1",
    ]);
  });
});
