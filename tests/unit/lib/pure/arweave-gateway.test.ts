import {
  buildArweaveGatewayBaseUrls,
  normalizeArweaveGatewayBaseUrl,
  parseArweaveGatewayBaseUrls,
} from "@/lib/pure/arweave-gateway";
import { describe, expect, it } from "bun:test";

describe("arweave-gateway", () => {
  it("parses a comma-separated gateway allowlist and keeps it normalized", () => {
    expect(
      parseArweaveGatewayBaseUrls(" https://arweave.net///,https://gateway.example/path/ , ,https://arweave.net "),
    ).toEqual(["https://arweave.net", "https://gateway.example/path"]);
  });

  it("builds gateway URLs with the preferred origin first and deduplicated fallbacks after it", () => {
    expect(
      buildArweaveGatewayBaseUrls({
        preferredGatewayBaseUrl: "https://permagate.io",
        fallbackGatewayBaseUrls: ["https://arweave.net", "https://permagate.io", "https://gateway.example"],
      }),
    ).toEqual(["https://permagate.io", "https://arweave.net", "https://gateway.example"]);
  });

  it("normalizes individual gateway URLs", () => {
    expect(normalizeArweaveGatewayBaseUrl("https://arweave.net///")).toBe("https://arweave.net");
  });
});
