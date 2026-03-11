/// <reference lib="dom" />

import "../../../preload";

import { PumpFunIcon } from "@/components/icons/pump-fun-icon";
import { render } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";

describe("PumpFunIcon", () => {
  it("renders without React invalid SVG prop warnings", () => {
    const originalConsoleError = console.error;
    const consoleError = mock(() => {});

    console.error = consoleError as typeof console.error;

    try {
      const { container } = render(<PumpFunIcon />);

      expect(container.querySelector("svg")).toBeDefined();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      console.error = originalConsoleError;
    }
  });
});
