import "../../preload";
import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { useImagePreload } from "@/hooks/use-image-preload";

// Mock Image constructor
class MockImage {
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    // Simulate async load
    setTimeout(() => {
      if (this.src && !this.src.includes("error")) {
        this.onload?.();
      } else if (this.src.includes("error")) {
        this.onerror?.();
      }
    }, 10);
  }
}

global.Image = MockImage as unknown as typeof Image;

describe("useImagePreload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should preload images when URLs are provided", async () => {
    const imageUrls = ["/api/r2/image1.webp", "/api/r2/image2.webp", "/api/r2/image3.webp"];

    const { result } = renderHook(() => useImagePreload(imageUrls));

    await waitFor(() => {
      expect(result.current.loadedCount).toBe(imageUrls.length);
    });

    expect(result.current.isComplete).toBe(true);
  });

  it("should handle empty URL array", () => {
    const { result } = renderHook(() => useImagePreload([]));

    expect(result.current.loadedCount).toBe(0);
    expect(result.current.isComplete).toBe(true);
  });

  it("should handle image load errors gracefully", async () => {
    const imageUrls = ["/api/r2/image1.webp", "/api/r2/error.webp", "/api/r2/image3.webp"];

    const { result } = renderHook(() => useImagePreload(imageUrls));

    await waitFor(() => {
      // Should complete even with errors
      expect(result.current.isComplete).toBe(true);
    });

    // Should have loaded 2 successful images
    expect(result.current.loadedCount).toBeGreaterThanOrEqual(2);
  });

  it("should update loadedCount as images load", async () => {
    const imageUrls = ["/api/r2/image1.webp", "/api/r2/image2.webp"];

    const { result } = renderHook(() => useImagePreload(imageUrls));

    // Initially should be 0
    expect(result.current.loadedCount).toBe(0);
    expect(result.current.isComplete).toBe(false);

    await waitFor(() => {
      expect(result.current.loadedCount).toBe(imageUrls.length);
    });

    expect(result.current.isComplete).toBe(true);
  });

  it("should handle URL changes", async () => {
    const { result, rerender } = renderHook(({ urls }: { urls: string[] }) => useImagePreload(urls), {
      initialProps: { urls: ["/api/r2/image1.webp"] },
    });

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });

    // Change URLs
    rerender({ urls: ["/api/r2/image2.webp", "/api/r2/image3.webp"] });

    // Should reset and start loading new images
    expect(result.current.loadedCount).toBe(0);
    expect(result.current.isComplete).toBe(false);

    await waitFor(() => {
      expect(result.current.isComplete).toBe(true);
    });
  });
});
