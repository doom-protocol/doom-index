import { describe, expect, it } from "bun:test";

import { buildFixtureArgs, parseArgs } from "../../../scripts/generate-framed-glb";

describe("unit/scripts/generate-framed-glb", () => {
  it("uses the shared public fixture assets by default", () => {
    expect(buildFixtureArgs()).toEqual({
      image: "/placeholder-painting.webp",
      output: "out/framed-painting.glb",
    });
  });

  it("parses explicit image and output flags without requiring a frontend base url", () => {
    expect(parseArgs(["--image", "/tmp/painting.webp", "--out", "/tmp/output.glb"])).toEqual({
      image: "/tmp/painting.webp",
      output: "/tmp/output.glb",
    });
  });
});
