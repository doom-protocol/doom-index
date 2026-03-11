import { describe, expect, it } from "bun:test";
import { env } from "@/env";

describe("unit/env", () => {
  it("parses validated public env values", () => {
    expect(env.NEXT_PUBLIC_GENERATION_INTERVAL_MS).toBe(600000);
    expect(env.NEXT_PUBLIC_R2_URL).toBe("/api/r2");
  });
});
