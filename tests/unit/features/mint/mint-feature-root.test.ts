import { describe, expect, it } from "bun:test";

describe("unit/features/mint/mint-feature-root", () => {
  it("mounts the modal closed first and opens it on the next animation frame", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { mock } from "bun:test";
          import { act, render } from "@testing-library/react";
          import { createElement } from "react";

          GlobalRegistrator.register();

          let requestAnimationFrameCallback = null;
          let timeoutCallback = null;

          window.requestAnimationFrame = (callback) => {
            requestAnimationFrameCallback = callback;
            return 1;
          };

          window.cancelAnimationFrame = () => {
            requestAnimationFrameCallback = null;
          };

          window.setTimeout = (callback) => {
            timeoutCallback = callback;
            return 1;
          };

          window.clearTimeout = () => {
            timeoutCallback = null;
          };

          mock.module("@/components/providers/lazy-wallet-provider", () => ({
            LazyWalletProvider: ({ children }) => children,
          }));

          mock.module("@/components/ui/mint-modal", () => ({
            MintModal: ({ isOpen, paintingMetadata }) =>
              createElement("div", {
                "data-open": String(isOpen),
                "data-painting-hash": paintingMetadata.paintingHash,
                "data-testid": "mint-modal-shell",
              }),
          }));

          const { MintFeatureRoot } = await import("@/features/mint/mint-feature-root");
          const { useMintFeatureStore } = await import("@/features/mint/store");

          const { getByTestId } = render(createElement(MintFeatureRoot));

          act(() => {
            useMintFeatureStore.getState().openMintFeature({
              timestamp: "2026-03-15T00:00:00.000Z",
              paintingHash: "painting-123",
              thumbnailUrl: "/painting.webp",
            });
          });

          const modalShell = getByTestId("mint-modal-shell");
          const initialOpen = modalShell.getAttribute("data-open");
          const initialPaintingHash = modalShell.getAttribute("data-painting-hash");
          const hasQueuedFrame = requestAnimationFrameCallback !== null;

          act(() => {
            requestAnimationFrameCallback?.(16.67);
          });

          const finalOpen = getByTestId("mint-modal-shell").getAttribute("data-open");

          act(() => {
            useMintFeatureStore.getState().closeMintFeature();
          });

          const closedOpen = getByTestId("mint-modal-shell").getAttribute("data-open");
          const hasCloseTimeout = timeoutCallback !== null;

          act(() => {
            useMintFeatureStore.getState().openMintFeature({
              timestamp: "2026-03-15T00:00:00.000Z",
              paintingHash: "painting-123",
              thumbnailUrl: "/painting.webp",
            });
          });

          const reopenInitialOpen = getByTestId("mint-modal-shell").getAttribute("data-open");
          const hasReopenFrame = requestAnimationFrameCallback !== null;

          act(() => {
            requestAnimationFrameCallback?.(33.34);
          });

          const reopenFinalOpen = getByTestId("mint-modal-shell").getAttribute("data-open");

          console.log(
            JSON.stringify({
              finalOpen,
              hasQueuedFrame,
              hasCloseTimeout,
              hasReopenFrame,
              initialOpen,
              initialPaintingHash,
              closedOpen,
              reopenFinalOpen,
              reopenInitialOpen,
            }),
          );
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      finalOpen: string | null;
      hasCloseTimeout: boolean;
      hasQueuedFrame: boolean;
      hasReopenFrame: boolean;
      initialOpen: string | null;
      initialPaintingHash: string | null;
      closedOpen: string | null;
      reopenFinalOpen: string | null;
      reopenInitialOpen: string | null;
    };

    expect(output.initialOpen).toBe("false");
    expect(output.finalOpen).toBe("true");
    expect(output.hasQueuedFrame).toBe(true);
    expect(output.closedOpen).toBe("false");
    expect(output.hasCloseTimeout).toBe(true);
    expect(output.reopenInitialOpen).toBe("false");
    expect(output.hasReopenFrame).toBe(true);
    expect(output.reopenFinalOpen).toBe("true");
    expect(output.initialPaintingHash).toBe("painting-123");
  });

  it("mounts the modal closed first even when the store is already open before the feature root mounts", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { mock } from "bun:test";
          import { act, render } from "@testing-library/react";
          import { createElement } from "react";

          GlobalRegistrator.register();

          let requestAnimationFrameCallback = null;

          window.requestAnimationFrame = (callback) => {
            requestAnimationFrameCallback = callback;
            return 1;
          };

          window.cancelAnimationFrame = () => {
            requestAnimationFrameCallback = null;
          };

          mock.module("@/components/providers/lazy-wallet-provider", () => ({
            LazyWalletProvider: ({ children }) => children,
          }));

          mock.module("@/components/ui/mint-modal", () => ({
            MintModal: ({ isOpen, paintingMetadata }) =>
              createElement("div", {
                "data-open": String(isOpen),
                "data-painting-hash": paintingMetadata.paintingHash,
                "data-testid": "mint-modal-shell",
              }),
          }));

          const { useMintFeatureStore } = await import("@/features/mint/store");

          act(() => {
            useMintFeatureStore.getState().openMintFeature({
              timestamp: "2026-03-15T00:00:00.000Z",
              paintingHash: "painting-preopened",
              thumbnailUrl: "/painting.webp",
            });
          });

          const { MintFeatureRoot } = await import("@/features/mint/mint-feature-root");
          const { getByTestId } = render(createElement(MintFeatureRoot));

          const initialOpen = getByTestId("mint-modal-shell").getAttribute("data-open");
          const initialPaintingHash = getByTestId("mint-modal-shell").getAttribute("data-painting-hash");
          const hasQueuedFrame = requestAnimationFrameCallback !== null;

          act(() => {
            requestAnimationFrameCallback?.(16.67);
          });

          const finalOpen = getByTestId("mint-modal-shell").getAttribute("data-open");

          console.log(
            JSON.stringify({
              finalOpen,
              hasQueuedFrame,
              initialOpen,
              initialPaintingHash,
            }),
          );
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      finalOpen: string | null;
      hasQueuedFrame: boolean;
      initialOpen: string | null;
      initialPaintingHash: string | null;
    };

    expect(output.initialOpen).toBe("false");
    expect(output.hasQueuedFrame).toBe(true);
    expect(output.finalOpen).toBe("true");
    expect(output.initialPaintingHash).toBe("painting-preopened");
  });
});
