import { describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { resolveLocalD1SqlitePath } from "@/server/db/helper";

describe("unit/server/db/helper", () => {
  it("returns the explicit path when provided", () => {
    expect(resolveLocalD1SqlitePath("/tmp/custom.sqlite")).toBe("/tmp/custom.sqlite");
  });

  it("selects the newest Wrangler local D1 sqlite file", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "doom-index-d1-"));
    const stateDir = join(tempRoot, "d1");
    mkdirSync(stateDir, { recursive: true });

    const olderPath = join(stateDir, "older.sqlite");
    const newerPath = join(stateDir, "newer.sqlite");

    writeFileSync(olderPath, "");
    writeFileSync(newerPath, "");
    utimesSync(olderPath, new Date("2026-03-10T00:00:00.000Z"), new Date("2026-03-10T00:00:00.000Z"));
    utimesSync(newerPath, new Date("2026-03-11T00:00:00.000Z"), new Date("2026-03-11T00:00:00.000Z"));

    try {
      expect(resolveLocalD1SqlitePath(undefined, stateDir)).toBe(newerPath);
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });

  it("throws when no Wrangler local D1 sqlite file exists", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "doom-index-d1-empty-"));

    try {
      expect(() => resolveLocalD1SqlitePath(undefined, tempRoot)).toThrow("Wrangler local D1 database not found");
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
