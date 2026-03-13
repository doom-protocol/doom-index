import { describe, expect, it } from "bun:test";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const readPackageJson = async () => {
  const packageJson = JSON.parse(await Bun.file("package.json").text()) as {
    scripts?: Record<string, string>;
  };
  return packageJson;
};

describe("unit/scripts/generate-command", () => {
  it("points the generate script at an existing TypeScript entrypoint", async () => {
    const packageJson = await readPackageJson();
    const generateScript = packageJson.scripts?.generate;

    expect(generateScript).toBeString();

    const entrypointMatch = generateScript?.match(/\bscripts\/[^\s]+\.ts\b/u);
    expect(entrypointMatch).not.toBeNull();

    const entrypoint = entrypointMatch?.[0];
    expect(entrypoint).toBeString();
    expect(entrypoint).toBeDefined();

    if (!entrypoint) {
      throw new Error("generate script entrypoint was not found");
    }

    expect(existsSync(resolve(process.cwd(), entrypoint))).toBe(true);
  });
});
