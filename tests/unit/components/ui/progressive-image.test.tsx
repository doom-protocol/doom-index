import "../../../preload";

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

describe("ProgressiveImage", () => {
  it("retries the next source before showing the failure fallback", async () => {
    const { ProgressiveImage } = await import("@/components/ui/progressive-image");

    const { getByAltText, queryByText } = render(
      <ProgressiveImage
        alt="Archive item"
        sources={["https://permagate.io/painting-1", "https://arweave.net/painting-1"]}
        src="https://permagate.io/painting-1"
        width={320}
        height={320}
      />,
    );

    expect(getByAltText("Archive item").getAttribute("src")).toBe("https://permagate.io/painting-1");

    fireEvent.error(getByAltText("Archive item"));

    expect(getByAltText("Archive item").getAttribute("src")).toBe("https://arweave.net/painting-1");
    expect(queryByText("Failed to load")).toBeNull();
  });

  it("shows the failure fallback after all sources fail", async () => {
    const { ProgressiveImage } = await import("@/components/ui/progressive-image");

    const { getByAltText, getByText } = render(
      <ProgressiveImage
        alt="Archive item"
        sources={["https://permagate.io/painting-1", "https://arweave.net/painting-1"]}
        src="https://permagate.io/painting-1"
        width={320}
        height={320}
      />,
    );

    fireEvent.error(getByAltText("Archive item"));
    fireEvent.error(getByAltText("Archive item"));

    expect(getByText("Failed to load")).toBeInTheDocument();
  });
});
