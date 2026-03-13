/// <reference lib="dom" />

import "../../preload";

import { describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";

describe("NotFound", () => {
  it("renders 404 page with correct copy", async () => {
    const { default: NotFound } = await import("@/app/not-found");
    const html = renderToString(<NotFound />);

    expect(html).toContain("404");
    expect(html).toContain("Page not found");
  });

  it("includes a link back to the gallery", async () => {
    const { default: NotFound } = await import("@/app/not-found");
    const html = renderToString(<NotFound />);

    expect(html).toContain("Return to gallery");
    expect(html).toContain('href="/"');
  });
});
