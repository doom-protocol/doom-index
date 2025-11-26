/// <reference lib="dom" />

import WhitepaperViewer from "@/components/about/whitepaper-viewer";
import { render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

describe("WhitepaperViewer", () => {
  it("should render children content", () => {
    const { container } = render(
      <WhitepaperViewer>
        <div>Test content</div>
      </WhitepaperViewer>,
    );
    expect(container.textContent).toContain("Test content");
  });

  it("should render container with Tailwind classes and data attribute", () => {
    const { container } = render(
      <WhitepaperViewer>
        <div>Test content</div>
      </WhitepaperViewer>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toBeDefined();
    expect(wrapper.className).toContain("w-full");
    expect(wrapper.className).toContain("h-full");
    expect(wrapper.className).toContain("bg-white");
    expect(wrapper.getAttribute("data-scrollable")).toBe("true");
  });
});
