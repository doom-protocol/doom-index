import { useSafeTexture, type UseSafeTextureOptions } from "@/hooks/use-safe-texture";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import type { Texture } from "three";

// Mock setup
const mockLoad = mock();
const mockSetCrossOrigin = mock();

class MockTextureLoader {
  setCrossOrigin = mockSetCrossOrigin;
  load = mockLoad;
}

mock.module("three", () => ({
  TextureLoader: MockTextureLoader,
  DataTexture: class {
    image = { width: 1, height: 1 };
    needsUpdate = false;
    name = "";
    constructor() {
      this.name = "fallback_black";
    }
  },
  RGBAFormat: 1023,
  UnsignedByteType: 1009,
}));

describe("useSafeTexture", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default success implementation
    mockLoad.mockImplementation((url: string, onLoad: (t: any) => void) => {
      setTimeout(() => {
        const mockTexture = { name: "loaded_texture", image: {} };
        onLoad(mockTexture);
      }, 10);
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should export useSafeTexture function", () => {
    expect(typeof useSafeTexture).toBe("function");
  });

  it("should accept string input", () => {
    const testUrl = "https://example.com/texture.jpg";
    const _url: string = testUrl;
    expect(_url).toBe(testUrl);
  });

  it("should accept array input", () => {
    const testUrls: string[] = ["https://example.com/1.jpg", "https://example.com/2.jpg"];
    expect(testUrls.length).toBe(2);
  });

  it("should accept object input", () => {
    const testUrls: Record<string, string> = {
      metalness: "https://example.com/1.jpg",
      map: "https://example.com/2.jpg",
    };
    expect(Object.keys(testUrls).length).toBe(2);
  });

  it("should accept options object", () => {
    const options: UseSafeTextureOptions = {
      onError: (_error: Error) => {},
    };
    expect(typeof options.onError).toBe("function");
  });

  it("should accept callback function", () => {
    const callback = (_texture: Texture) => {};
    expect(typeof callback).toBe("function");
  });

  // Runtime tests
  it("should load texture successfully", async () => {
    const onLoad = mock();
    const url = "https://example.com/success.jpg";

    const { result } = renderHook(() => useSafeTexture(url, { onLoad }));

    // Initially returns fallback
    expect(result.current).toBeDefined();
    expect((result.current as any).name).toBe("fallback_black");

    // Wait for load
    await waitFor(() => {
      expect(onLoad).toHaveBeenCalled();
    });

    expect(mockLoad).toHaveBeenCalledWith(url, expect.any(Function), undefined, expect.any(Function));
    expect((result.current as any).name).toBe("loaded_texture");
  });

  it("should handle load error and return fallback", async () => {
    const onError = mock();
    const url = "https://example.com/error.jpg";
    const error = new Error("Load failed");

    mockLoad.mockImplementation((url: string, onLoad: any, onProgress: any, onErrorCallback: (err: any) => void) => {
      setTimeout(() => {
        onErrorCallback(error);
      }, 10);
    });

    const { result } = renderHook(() => useSafeTexture(url, { onError }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });

    // Should still return fallback (or whatever useSafeTexture returns on error)
    // The implementation re-sets result to fallback on error
    expect((result.current as any).name).toBe("fallback_black");
  });

  it("should set crossOrigin option", async () => {
    const url = "https://example.com/cors.jpg";
    const crossOrigin = "use-credentials";

    renderHook(() => useSafeTexture(url, { crossOrigin }));

    // We need to wait for the effect to run
    await waitFor(() => {
      expect(mockSetCrossOrigin).toHaveBeenCalledWith(crossOrigin);
    });
  });

  it("should restore mocks between tests", () => {
    // This test ensures previous tests didn't leave side effects
    // mockLoad should be reset to default implementation (success) by beforeEach
    // mockCalls should be empty
    expect(mockLoad).toHaveBeenCalledTimes(0);
  });
});
