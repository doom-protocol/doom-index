import { describe, expect, it } from "bun:test";

describe("unit/app/layout", () => {
  it("keeps the root ViewTransition boundary in the app layout", async () => {
    const source = await Bun.file("src/app/layout.tsx").text();

    expect(source.includes('import { AppViewTransition } from "@/components/app-view-transition";')).toBe(true);
    expect(source.includes("<AppViewTransition>")).toBe(true);
    expect(source.includes("</AppViewTransition>")).toBe(true);
  });
});
