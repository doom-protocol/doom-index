import "../../preload";

import { useViewerCount } from "@/hooks/use-viewer-count";
import { describe, expect, it, mock } from "bun:test";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

function TestComponent() {
  const { count } = useViewerCount();

  return <div>{count ?? "none"}</div>;
}

describe("useViewerCount", () => {
  it("does not emit the getServerSnapshot cache warning during hydration", async () => {
    const consoleErrorMock = mock(() => {});
    const originalConsoleError = console.error;

    console.error = consoleErrorMock as typeof console.error;

    try {
      const html = renderToString(<TestComponent />);
      const container = document.createElement("div");

      container.innerHTML = html;

      let root: Root | undefined;

      await act(async () => {
        root = hydrateRoot(container, <TestComponent />);
        await Promise.resolve();
      });

      root?.unmount();

      const errorMessages = consoleErrorMock.mock.calls.map((args) => args.map((value) => String(value)).join(" "));

      expect(
        errorMessages.some((message) =>
          message.includes("The result of getServerSnapshot should be cached to avoid an infinite loop"),
        ),
      ).toBe(false);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
