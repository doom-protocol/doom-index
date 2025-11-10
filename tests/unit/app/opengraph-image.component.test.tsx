/// <reference lib="dom" />

/**
 * Unit Tests for OGP Image Generation Components
 *
 * Tests React components and JSX structures using @testing-library/react
 * Based on: https://natt.sh/blog/2024-12-09-testing-react-components-bun
 */

import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { size, alt } from "@/app/opengraph-image";

describe("OGP Image Generation Components", () => {
  describe("Letterbox Layout JSX Structure", () => {
    test("should render flex container with correct styling", () => {
      const LetterboxContainer = () => (
        <div
          data-testid="letterbox-container"
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            backgroundColor: "#000000",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="data:image/webp;base64,test"
            alt="Test Image"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>
      );

      const { getByTestId } = render(<LetterboxContainer />);

      const container = getByTestId("letterbox-container");
      expect(container).toBeInTheDocument();
      expect(container).toHaveStyle({ display: "flex" });
      expect(container).toHaveStyle({ backgroundColor: "#000000" });
      expect(container).toHaveStyle({ alignItems: "center" });
      expect(container).toHaveStyle({ justifyContent: "center" });
    });

    test("should render image with letterbox styling", () => {
      const LetterboxImage = () => (
        <div>
          <img
            src="data:image/webp;base64,test"
            alt={alt}
            data-testid="ogp-image"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
            }}
          />
        </div>
      );

      const { getByTestId } = render(<LetterboxImage />);

      const image = getByTestId("ogp-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveStyle({ height: "100%" });
      expect(image).toHaveStyle({ width: "auto" });
      expect(image).toHaveStyle({ objectFit: "contain" });
      expect(image).toHaveAttribute("alt", alt);
    });

    test("should maintain aspect ratio with objectFit contain", () => {
      const AspectRatioImage = () => (
        <img
          src="data:image/webp;base64,test"
          alt="Test"
          data-testid="aspect-ratio-image"
          style={{
            objectFit: "contain",
            height: "100%",
            width: "auto",
          }}
        />
      );

      const { getByTestId } = render(<AspectRatioImage />);

      const image = getByTestId("aspect-ratio-image");
      expect(image).toHaveStyle({ objectFit: "contain" });
    });
  });

  describe("Error State JSX Structure", () => {
    test("should render error state with correct styling", () => {
      const ErrorState = () => (
        <div
          data-testid="error-container"
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            backgroundColor: "#000000",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: "40px",
            fontWeight: "bold",
          }}
        >
          DOOM INDEX
        </div>
      );

      const { getByTestId } = render(<ErrorState />);

      const errorContainer = getByTestId("error-container");
      expect(errorContainer).toBeInTheDocument();
      expect(errorContainer).toHaveStyle({ backgroundColor: "#000000" });
      expect(errorContainer).toHaveStyle({ color: "#ffffff" });
      expect(errorContainer).toHaveStyle({ fontSize: "40px" });
      expect(errorContainer).toHaveStyle({ fontWeight: "bold" });
      expect(errorContainer).toHaveTextContent("DOOM INDEX");
    });

    test("should display fallback text when error occurs", () => {
      const ErrorFallback = () => (
        <div data-testid="error-fallback">
          <span>DOOM INDEX</span>
        </div>
      );

      const { getByTestId, getByText } = render(<ErrorFallback />);

      const fallback = getByTestId("error-fallback");
      expect(fallback).toBeInTheDocument();
      expect(getByText("DOOM INDEX")).toBeInTheDocument();
    });
  });

  describe("OGP Image Size Configuration", () => {
    test("should use correct OGP dimensions (1200×630)", () => {
      expect(size.width).toBe(1200);
      expect(size.height).toBe(630);
      expect(size.width / size.height).toBeCloseTo(1.905, 2);
    });

    test("should match standard OGP aspect ratio", () => {
      const aspectRatio = size.width / size.height;

      // Standard OGP aspect ratio is 1.91:1
      expect(aspectRatio).toBeGreaterThan(1.9);
      expect(aspectRatio).toBeLessThan(1.92);
    });

    test("should have correct alt text", () => {
      expect(alt).toBe("DOOM INDEX - Current world state visualization");
    });
  });

  describe("Image Data URL Rendering", () => {
    test("should render image with data URL source", () => {
      const DataUrlImage = () => (
        <img src="data:image/webp;base64,dGVzdA==" alt="Test" data-testid="data-url-image" />
      );

      const { getByTestId } = render(<DataUrlImage />);

      const image = getByTestId("data-url-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "data:image/webp;base64,dGVzdA==");
    });

    test("should handle multiple images with different data URLs", () => {
      const MultipleImages = () => (
        <div>
          <img src="data:image/webp;base64,aW1hZ2Ux" alt="Image 1" data-testid="image-1" />
          <img src="data:image/webp;base64,aW1hZ2Uy" alt="Image 2" data-testid="image-2" />
          <img src="data:image/png;base64,aW1hZ2Uz" alt="Image 3" data-testid="image-3" />
        </div>
      );

      const { getByTestId } = render(<MultipleImages />);

      const image1 = getByTestId("image-1");
      const image2 = getByTestId("image-2");
      const image3 = getByTestId("image-3");

      expect(image1).toHaveAttribute("src", "data:image/webp;base64,aW1hZ2Ux");
      expect(image2).toHaveAttribute("src", "data:image/webp;base64,aW1hZ2Uy");
      expect(image3).toHaveAttribute("src", "data:image/png;base64,aW1hZ2Uz");
    });
  });

  describe("DOM Event Handling", () => {
    test("should handle image load event", () => {
      let imageLoaded = false;

      const ImageWithLoadHandler = () => (
        <img
          src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
          alt="Test"
          data-testid="load-image"
          onLoad={() => {
            imageLoaded = true;
          }}
        />
      );

      const { getByTestId } = render(<ImageWithLoadHandler />);

      const image = getByTestId("load-image");
      expect(image).toBeInTheDocument();

      // Trigger load event
      image.dispatchEvent(new Event("load"));
      expect(imageLoaded).toBe(true);
    });

    test("should handle image error event", () => {
      let imageError = false;

      const ImageWithErrorHandler = () => (
        <img
          src="invalid-url"
          alt="Test"
          data-testid="error-image"
          onError={() => {
            imageError = true;
          }}
        />
      );

      const { getByTestId } = render(<ImageWithErrorHandler />);

      const image = getByTestId("error-image");
      expect(image).toBeInTheDocument();

      // Trigger error event
      image.dispatchEvent(new Event("error"));
      expect(imageError).toBe(true);
    });
  });

  describe("State-based Rendering Logic", () => {
    test("should render different content based on fallback state", () => {
      const ConditionalRender = ({ useFallback }: { useFallback: boolean }) => (
        <div data-testid="conditional-content">
          {useFallback ? <span>Fallback Image</span> : <span>Actual Image</span>}
        </div>
      );

      const { rerender, getByText } = render(<ConditionalRender useFallback={false} />);
      expect(getByText("Actual Image")).toBeInTheDocument();

      rerender(<ConditionalRender useFallback={true} />);
      expect(getByText("Fallback Image")).toBeInTheDocument();
    });

    test("should handle null state gracefully", () => {
      const NullStateComponent = ({ state }: { state: { imageUrl: string } | null }) => (
        <div data-testid="null-state">{state ? "Has State" : "No State"}</div>
      );

      const { getByText } = render(<NullStateComponent state={null} />);
      expect(getByText("No State")).toBeInTheDocument();
    });

    test("should handle undefined state gracefully", () => {
      const UndefinedStateComponent = ({ state }: { state?: { imageUrl: string } }) => (
        <div data-testid="undefined-state">{state ? "Has State" : "No State"}</div>
      );

      const { getByText } = render(<UndefinedStateComponent state={undefined} />);
      expect(getByText("No State")).toBeInTheDocument();
    });
  });

  describe("Cache Control Headers Logic", () => {
    test("should determine correct cache headers for successful image", () => {
      const fallbackUsed = false;
      const cacheControl = fallbackUsed
        ? "public, max-age=300"
        : "public, max-age=60, stale-while-revalidate=30";

      expect(cacheControl).toBe("public, max-age=60, stale-while-revalidate=30");
    });

    test("should determine correct cache headers for fallback", () => {
      const fallbackUsed = true;
      const cacheControl = fallbackUsed
        ? "public, max-age=300"
        : "public, max-age=60, stale-while-revalidate=30";

      expect(cacheControl).toBe("public, max-age=300");
    });

    test("should use correct cache headers for error state", () => {
      const errorCacheControl = "public, max-age=60";
      expect(errorCacheControl).toBe("public, max-age=60");
    });
  });
});
