import { describe, expect, it } from "bun:test";

describe("unit/app/layout", () => {
  it("keeps the root ViewTransition boundary in the app layout", async () => {
    const source = await Bun.file("src/app/layout.tsx").text();

    expect(source.includes('import { ViewTransition } from "react";')).toBe(true);
    expect(source.includes("<ViewTransition>")).toBe(true);
    expect(source.includes("</ViewTransition>")).toBe(true);
  });
});
