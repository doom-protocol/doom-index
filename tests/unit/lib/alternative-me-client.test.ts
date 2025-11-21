import { describe, it, expect, beforeEach } from "bun:test";
import { AlternativeMeClient } from "@/lib/alternative-me-client";

describe("AlternativeMeClient", () => {
  let client: AlternativeMeClient;

  beforeEach(() => {
    client = new AlternativeMeClient();
  });

  describe("getFearGreedIndex", () => {
    it("should fetch Fear & Greed Index successfully", async () => {
      // Mock fetch
      global.fetch = Object.assign(
        async () => {
          return new Response(
            JSON.stringify({
              data: [
                {
                  value: "50",
                  value_classification: "Neutral",
                  timestamp: "1700000000",
                },
              ],
            }),
            { status: 200 },
          );
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(50);
        expect(result.value.valueClassification).toBe("Neutral");
        expect(result.value.timestamp).toBe(1700000000);
      }
    });

    it("should handle Extreme Fear classification", async () => {
      global.fetch = Object.assign(
        async () => {
          return new Response(
            JSON.stringify({
              data: [
                {
                  value: "10",
                  value_classification: "Extreme Fear",
                  timestamp: "1700000000",
                },
              ],
            }),
            { status: 200 },
          );
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(10);
        expect(result.value.valueClassification).toBe("Extreme Fear");
      }
    });

    it("should handle Extreme Greed classification", async () => {
      global.fetch = Object.assign(
        async () => {
          return new Response(
            JSON.stringify({
              data: [
                {
                  value: "90",
                  value_classification: "Extreme Greed",
                  timestamp: "1700000000",
                },
              ],
            }),
            { status: 200 },
          );
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.value).toBe(90);
        expect(result.value.valueClassification).toBe("Extreme Greed");
      }
    });

    it("should return error when API returns non-200 status", async () => {
      global.fetch = Object.assign(
        async () => {
          return new Response("Not Found", { status: 404 });
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("alternative.me");
          expect(result.error.status).toBe(404);
        }
      }
    });

    it("should return error when API returns invalid JSON", async () => {
      global.fetch = Object.assign(
        async () => {
          return new Response("Invalid JSON", { status: 200 });
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("alternative.me");
        }
      }
    });

    it("should return error when API returns empty data array", async () => {
      global.fetch = Object.assign(
        async () => {
          return new Response(
            JSON.stringify({
              data: [],
            }),
            { status: 200 },
          );
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("alternative.me");
        }
      }
    });

    it("should return error when fetch throws", async () => {
      global.fetch = Object.assign(
        async () => {
          throw new Error("Network error");
        },
        { preconnect: () => {} },
      ) as typeof fetch;

      const result = await client.getFearGreedIndex();

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.type).toBe("ExternalApiError");
        if (result.error.type === "ExternalApiError") {
          expect(result.error.provider).toBe("alternative.me");
          expect(result.error.message).toContain("Network error");
        }
      }
    });
  });
});
