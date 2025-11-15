import { describe, it, expect } from "bun:test";
import { createStateService } from "@/services/state";
import { createTestR2Bucket } from "@/testing/memory-r2";
import type { GlobalState, TokenState, RevenueReport } from "@/types/domain";

describe("StateService (5.1)", () => {
  it("reads and writes global state JSON", async () => {
    const { bucket } = createTestR2Bucket();
    const service = createStateService({ r2Bucket: bucket });
    const initial = await service.readGlobalState();
    expect(initial.isOk()).toBe(true);
    if (initial.isOk()) {
      expect(initial.value).toBeNull();
    }

    const state: GlobalState = { prevHash: "hash", lastTs: "2025-11-09T12:34", imageUrl: "https://image" };
    const writeResult = await service.writeGlobalState(state);
    expect(writeResult.isOk()).toBe(true);

    const readBack = await service.readGlobalState();
    expect(readBack.isOk()).toBe(true);
    if (readBack.isOk()) {
      expect(readBack.value).toEqual(state);
    }
  });

  it("writes token states individually", async () => {
    const { bucket, store } = createTestR2Bucket();
    const service = createStateService({ r2Bucket: bucket });
    const states: TokenState[] = [
      { ticker: "CO2", thumbnailUrl: "https://img", updatedAt: "2025-11-09T12:34:00Z" },
      { ticker: "ICE", thumbnailUrl: "https://img", updatedAt: "2025-11-09T12:34:00Z" },
    ];
    const result = await service.writeTokenStates(states);
    expect(result.isOk()).toBe(true);

    const stored = store.get("state/CO2.json");
    expect(stored).toBeDefined();
    const text = stored?.content as string;
    expect(JSON.parse(text)).toEqual(states[0]);

    const readState = await service.readTokenState("CO2");
    expect(readState.isOk()).toBe(true);
    if (readState.isOk()) {
      expect(readState.value).toEqual(states[0]);
    }
  });

  it("persists revenue reports", async () => {
    const { bucket, store } = createTestR2Bucket();
    const service = createStateService({ r2Bucket: bucket });
    const report: RevenueReport = {
      perTokenFee: { CO2: 1, ICE: 1, FOREST: 1, NUKE: 1, MACHINE: 1, PANDEMIC: 1, FEAR: 1, HOPE: 1 },
      totalFee: 8,
      monthlyCost: 100,
      netProfit: -92,
    };
    const writeResult = await service.writeRevenue(report, "2025-11-09T12:34");
    expect(writeResult.isOk()).toBe(true);
    const stored = store.get("revenue/2025-11-09T12:34.json");
    expect(stored).toBeDefined();

    const readBack = await service.readRevenue("2025-11-09T12:34");
    expect(readBack.isOk()).toBe(true);
    if (readBack.isOk()) {
      expect(readBack.value).toEqual(report);
    }
  });
});
