import "../../../preload";

import type { Painting } from "@/types/paintings";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

function createPainting(id: number): Painting {
  return {
    id: `painting-${String(id)}`,
    timestamp: "2026-03-14T00:00:00.000Z",
    minuteBucket: "2026-03-14T00:00",
    paramsHash: `params-${String(id)}`,
    seed: `seed-${String(id)}`,
    imageUrl: `https://permagate.io/painting-${String(id)}`,
    fileSize: 1024,
    visualParams: {
      fogDensity: 0,
      skyTint: 0,
      reflectivity: 0,
      blueBalance: 0,
      vegetationDensity: 0,
      organicPattern: 0,
      radiationGlow: 0,
      debrisIntensity: 0,
      mechanicalPattern: 0,
      metallicRatio: 0,
      fractalDensity: 0,
      bioluminescence: 0,
      shadowDepth: 0,
      redHighlight: 0,
      lightIntensity: 0,
      warmHue: 0,
    },
    prompt: "prompt",
    negative: "negative",
  };
}

describe("ArchiveGrid", () => {
  beforeEach(() => {
    mock.restore();
    void mock.module("next/image", () => ({
      default: ({
        alt,
        src,
        loading,
        unoptimized,
      }: {
        alt: string;
        src: string;
        loading?: "eager" | "lazy";
        unoptimized?: boolean;
      }) => (
        <div
          aria-label={alt}
          data-loading={loading ?? "lazy"}
          data-src={src}
          data-unoptimized={unoptimized ? "true" : "false"}
          role="img"
        />
      ),
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it("eager-loads only the first archive row images", async () => {
    const { ArchiveGrid } = await import("@/components/archive/archive-grid");
    const items = Array.from({ length: 8 }, (_, index) => createPainting(index + 1));

    const { getAllByRole } = render(<ArchiveGrid items={items} />);

    const images = getAllByRole("img");

    expect(images).toHaveLength(8);
    expect(images.slice(0, 6).every((image) => image.getAttribute("data-loading") === "eager")).toBe(true);
    expect(images.slice(6).every((image) => image.getAttribute("data-loading") === "lazy")).toBe(true);
  });

  it("bypasses the Next image optimizer for remote archive images", async () => {
    const { ArchiveGrid } = await import("@/components/archive/archive-grid");
    const items = Array.from({ length: 2 }, (_, index) => createPainting(index + 1));

    const { getAllByRole } = render(<ArchiveGrid items={items} />);

    const images = getAllByRole("img");

    expect(images.every((image) => image.getAttribute("data-unoptimized") === "true")).toBe(true);
  });
});
