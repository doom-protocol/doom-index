import "../../../preload";

import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createElement } from "react";
import type { ReactEventHandler } from "react";

describe("ProgressiveImage", () => {
  beforeEach(() => {
    mock.restore();
    void mock.module("next/image", () => ({
      default: ({
        alt,
        className,
        onError,
        onLoad,
        src,
      }: {
        alt: string;
        className?: string;
        onError?: ReactEventHandler<HTMLImageElement>;
        onLoad?: ReactEventHandler<HTMLImageElement>;
        src: string;
      }) => createElement("img", { alt, className, onError, onLoad, src }),
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it("retries the next source before showing the failure fallback", async () => {
    const { ProgressiveImage } = await import("@/components/ui/progressive-image");

    const { getByAltText, queryByText } = render(
      <ProgressiveImage
        alt="Archive item"
        sources={["https://permagate.io/painting-1", "https://arweave.net/painting-1"]}
        src="https://permagate.io/painting-1"
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
      />,
    );

    fireEvent.error(getByAltText("Archive item"));
    fireEvent.error(getByAltText("Archive item"));

    expect(getByText("Failed to load")).toBeInTheDocument();
  });
});
