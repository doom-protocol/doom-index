import { QUANTIZE_DECIMALS } from "@/constants/token";
import { describe, expect, it } from "bun:test";

/**
 * Legacy token configuration tests
 * @deprecated These tests are for the legacy 8-token system which has been removed.
 */
describe("Token configuration (legacy)", () => {
  it("exports QUANTIZE_DECIMALS constant", () => {
    expect(typeof QUANTIZE_DECIMALS).toBe("number");
    expect(QUANTIZE_DECIMALS).toBeGreaterThan(0);
  });
});
