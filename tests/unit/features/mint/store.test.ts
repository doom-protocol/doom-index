import { describe, expect, it } from "bun:test";

describe("unit/features/mint/store", () => {
  it("loads the mint feature store without importing the mint modal UI", () => {
    const result = Bun.spawnSync({
      cmd: [
        "bun",
        "--eval",
        `
          import { mock } from "bun:test";
          import { join } from "node:path";
          import { pathToFileURL } from "node:url";

          mock.module("@/components/ui/mint-modal", () => {
            throw new Error("mint feature store must not import UI components");
          });

          const moduleUrl = pathToFileURL(join(process.cwd(), "src/features/mint/store.ts"));
          moduleUrl.searchParams.set("test", String(Date.now()));
          const { useMintFeatureStore } = await import(moduleUrl.href);

          console.log(
            JSON.stringify({
              isOpen: useMintFeatureStore.getState().isOpen,
              paintingMetadata: useMintFeatureStore.getState().paintingMetadata,
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
      isOpen: boolean;
      paintingMetadata: null;
    };
    expect(output.isOpen).toBe(false);
    expect(output.paintingMetadata).toBeNull();
  });
});
