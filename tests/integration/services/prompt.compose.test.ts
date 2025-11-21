import { describe, it, expect } from "bun:test";
import { createWorldPromptService } from "@/services/world-prompt-service";
import type { McMapRounded } from "@/constants/token";

const createService = (minute = "2025-11-09T12:34") =>
  createWorldPromptService({
    getMinuteBucket: () => minute,
  });

/**
 * Legacy prompt composition tests
 * @deprecated These tests are for the legacy composePrompt function which is deprecated.
 */
describe.skip("WorldPromptService.composePrompt (legacy)", () => {
  it("returns prompt composition with empty mcRounded", async () => {
    // Legacy composePrompt method has been removed
    // Only composeTokenPrompt is available now
    const mcRounded: McMapRounded = {};
    const service = createService();

    // @ts-expect-error - composePrompt no longer exists
    const result = await service.composePrompt(mcRounded);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const value = result.value;
      expect(value.paramsHash).toMatch(/^[a-f0-9]{8}$/);
      expect(value.seed).toMatch(/^[a-f0-9]{12}$/);
      expect(value.prompt.size).toEqual({ w: 1024, h: 1024 });
      expect(value.prompt.format).toBe("webp");
      expect(value.prompt.text).toContain("baroque");
      expect(value.prompt.text).toContain("allegorical");
      expect(value.prompt.negative).toContain("watermark");
    }
  });
});
