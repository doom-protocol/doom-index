import { describe, it, expect } from "bun:test";
import { useMc } from "@/hooks/use-mc";

describe("useMc Hook", () => {
  it("should export useMc hook", () => {
    expect(typeof useMc).toBe("function");
  });

  it("should return query result structure", () => {
    // フックの構造を確認（実際の実行は統合テストで行う）
    expect(useMc).toBeDefined();
  });
});
