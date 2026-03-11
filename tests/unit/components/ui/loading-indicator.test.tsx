/// <reference lib="dom" />

import "../../../preload";

import { describe, expect, it, mock } from "bun:test";
import { renderToString } from "react-dom/server";

describe("LoadingIndicator", () => {
  it("server-renders without injecting an inline style tag", async () => {
    const linkStatus = () => ({ pending: false });

    void mock.module("next/link", () => ({
      useLinkStatus: linkStatus,
    }));

    const { LoadingIndicator } = await import("@/components/ui/loading-indicator");
    const html = renderToString(<LoadingIndicator />);

    expect(html).toContain("opacity-0");
    expect(html).not.toContain("<style>");
  });
});
