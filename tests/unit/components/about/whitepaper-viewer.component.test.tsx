/// <reference lib="dom" />

import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { render } from "@testing-library/react";
import WhitepaperViewer from "@/components/about/whitepaper-viewer";

// Mock CSS modules
beforeEach(() => {
  mock.module("@/components/about/whitepaper-viewer.module.css", () => ({
    default: {
      container: "container",
    },
  }));
});

afterEach(() => {
  mock.restore();
});

describe("WhitepaperViewer", () => {
  it("should render children content", () => {
    const { container } = render(
      <WhitepaperViewer>
        <div>Test content</div>
      </WhitepaperViewer>,
    );
    expect(container.textContent).toContain("Test content");
  });

  it("should render container with CSS module class", () => {
    const { container } = render(
      <WhitepaperViewer>
        <div>Test content</div>
      </WhitepaperViewer>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeDefined();
    expect(wrapper.className).toContain("container");
    expect(wrapper.getAttribute("data-scrollable")).toBe("true");
  });
});
