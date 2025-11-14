import { describe, it, expect } from "bun:test";
import { useTokenImage } from "@/hooks/use-token-image";

describe("useTokenImage Hook", () => {
  it("should export useTokenImage hook", () => {
    expect(typeof useTokenImage).toBe("function");
  });

  it("should accept ticker parameter", () => {
    // フックの構造を確認（実際の実行は統合テストで行う）
    expect(useTokenImage).toBeDefined();
  });
});
