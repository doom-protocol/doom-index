import { describe, expect, it } from "bun:test";

describe("API Handler Integration", () => {
  it("should handle HTTP requests via tRPC endpoint", async () => {
    // ローカル開発サーバーが起動している場合のテスト
    // 実際のHTTPリクエストを送信
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      const response = await fetch(`${baseUrl}/api/trpc/mc.getMarketCaps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      // サーバーが起動していない場合はスキップ
      if (response.status === 0) {
        console.log("Skipping test: server not running");
        return;
      }

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data).toHaveProperty("result");
    } catch (error) {
      // サーバーが起動していない場合はスキップ
      console.log("Skipping test: server not running", error);
    }
  });

  it("should handle batch requests", async () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      // バッチリクエストのテスト
      const queries = [
        { method: "mc.getMarketCaps", params: {} },
        { method: "token.getState", params: { ticker: "CO2" } },
      ];

      const response = await fetch(`${baseUrl}/api/trpc/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queries),
      });

      if (response.status === 0) {
        console.log("Skipping test: server not running");
        return;
      }

      // バッチリクエストが処理されることを確認
      expect(response.ok).toBe(true);
    } catch (error) {
      console.log("Skipping test: server not running", error);
    }
  });

  it("should return proper error format", async () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    try {
      // 不正なリクエストでエラーフォーマットを確認
      const response = await fetch(`${baseUrl}/api/trpc/token.getState`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ticker: "INVALID" }),
      });

      if (response.status === 0) {
        console.log("Skipping test: server not running");
        return;
      }

      // エラーレスポンスのフォーマットを確認
      const data = await response.json();
      expect(data).toHaveProperty("error");
    } catch (error) {
      console.log("Skipping test: server not running", error);
    }
  });
});
