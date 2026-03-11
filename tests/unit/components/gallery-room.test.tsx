import "../../preload";

import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";

const galleryRoomSource = readFileSync(
  new URL("../../../src/components/gallery/gallery-room.tsx", import.meta.url),
  "utf8",
);

describe("unit/components/gallery-room", () => {
  it("does not render a ceiling mesh", () => {
    expect(galleryRoomSource.match(/<mesh\b/g)).toHaveLength(5);
    expect(galleryRoomSource).not.toContain("position={[0, 3.3, 0]}");
  });
});
