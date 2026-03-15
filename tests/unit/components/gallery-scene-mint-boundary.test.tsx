import { describe, expect, it } from "bun:test";

describe("unit/components/gallery-scene mint boundary", () => {
  it("does not render the mint feature root until the mint flow is opened", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { GlobalRegistrator } from "@happy-dom/global-registrator";
          import { fireEvent, render, waitFor } from "@testing-library/react";
          import { createElement } from "react";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          GlobalRegistrator.register();

          let mintFeatureRootImportCount = 0;

          mock.module("@/env", () => ({
            isDevelopment: () => false,
            publicEnv: {
              NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
              NEXT_PUBLIC_GENERATION_INTERVAL_MS: "600000",
            },
          }));

          mock.module("@/hooks/use-latest-painting", () => ({
            useLatestPainting: () => ({
              data: {
                id: "painting-123",
                timestamp: "2026-03-15T00:00:00.000Z",
                imageUrl: "https://permagate.io/painting-123",
              },
              isFetching: false,
            }),
          }));

          mock.module("@react-three/fiber", () => ({
            Canvas: ({ children }) => createElement("div", { "data-testid": "canvas" }, children),
          }));

          mock.module("@react-three/drei", () => ({
            Grid: () => null,
            OrbitControls: () => null,
          }));

          mock.module("three", () => ({
            ACESFilmicToneMapping: 1,
            PCFSoftShadowMap: 1,
          }));

          mock.module("next/dynamic", () => ({
            default: (loader) => {
              return function DynamicComponent(props) {
                const [Component, setComponent] = React.useState(null);

                React.useEffect(() => {
                  let mounted = true;
                  void loader().then((loaded) => {
                    if (!mounted) return;
                    const resolved = typeof loaded === "function" ? loaded : loaded.default;
                    setComponent(() => resolved);
                  });
                  return () => {
                    mounted = false;
                  };
                }, []);

                return Component ? createElement(Component, props) : null;
              };
            },
          }));

          mock.module("@/components/gallery/camera-rig", () => ({
            CameraRig: () => null,
          }));

          mock.module("@/components/gallery/framed-painting", () => ({
            FramedPainting: () => createElement("div", { "data-testid": "framed-painting" }),
          }));

          mock.module("@/components/gallery/gallery-room", () => ({
            GALLERY_BACK_WALL_Z: 5,
            GALLERY_FLOOR_Y: 0.3,
            GalleryRoom: () => null,
          }));

          mock.module("@/components/gallery/lights", () => ({
            Lights: () => null,
          }));

          mock.module("@/components/ui/mint-button", () => ({
            MintButton: ({ disabled, onClick }) =>
              createElement(
                "button",
                {
                  disabled,
                  onClick,
                  type: "button",
                },
                "Mint",
              ),
          }));

          mock.module("@/components/ui/three-error-boundary", () => ({
            ThreeErrorBoundary: ({ children }) => children,
          }));

          mock.module("@/lib/pure/gallery-orbit-bounds", () => ({
            constrainOrbitControlsSnapshot: (controls) => controls,
            isOrbitControlsWithinBounds: () => true,
            restoreOrbitControlsSnapshot: () => {},
          }));

          mock.module("@/utils/logger", () => ({
            logger: {
              debug: () => {},
              error: () => {},
              info: () => {},
              warn: () => {},
            },
          }));

          mock.module("@/features/mint/mint-feature-root", () => ({
            ...(mintFeatureRootImportCount++, {}),
            MintFeatureRoot: () => createElement("div", { "data-testid": "mint-feature-root" }),
          }));

          const React = await import("react");
          const { useMintFeatureStore } = await import("@/features/mint/store");
          useMintFeatureStore.getState().resetMintFeature();

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/components/gallery/gallery-scene.tsx"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { GalleryScene } = await import(moduleUrl.href);

          const { getByRole, queryByTestId } = render(createElement(GalleryScene));

          await Promise.resolve();
          await Promise.resolve();

          const importCountBeforeClick = mintFeatureRootImportCount;
          const initialRootVisible = queryByTestId("mint-feature-root") !== null;

          fireEvent.click(getByRole("button", { name: /mint/i }));

          await waitFor(() => {
            if (queryByTestId("mint-feature-root") === null) {
              throw new Error("mint feature root not visible yet");
            }
          });

          const openedRootVisible = queryByTestId("mint-feature-root") !== null;

          console.log(JSON.stringify({
            importCountBeforeClick,
            importCountAfterClick: mintFeatureRootImportCount,
            initialRootVisible,
            openedRootVisible,
          }));
        `,
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_BASE_URL: "http://localhost:8787",
        NEXT_PUBLIC_GENERATION_INTERVAL_MS: "600000",
        LOG_LEVEL: "DEBUG",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    expect(result.exitCode).toBe(0);

    const output = JSON.parse(new TextDecoder().decode(result.stdout).trim()) as {
      importCountAfterClick: number;
      importCountBeforeClick: number;
      initialRootVisible: boolean;
      openedRootVisible: boolean;
    };

    expect(output.importCountBeforeClick).toBe(0);
    expect(output.importCountAfterClick).toBe(1);
    expect(output.initialRootVisible).toBe(false);
    expect(output.openedRootVisible).toBe(true);
  });
});
