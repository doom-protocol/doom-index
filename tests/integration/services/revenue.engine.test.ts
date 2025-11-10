import { describe, it, expect } from "bun:test";
import { createRevenueEngine } from "@/services/revenue";
import { TOKEN_TICKERS } from "@/constants/token";
import type { TradeSnapshot } from "@/types/domain";

const feeRate = 0.0005;

const createSnapshots = (value: number): TradeSnapshot[] =>
  TOKEN_TICKERS.map(ticker => ({
    ticker,
    tradesPerMinute: value,
    averageTradeUsd: value * 10,
  }));

const perTokenFee = (trades: number, avg: number) => trades * avg * feeRate;

describe("RevenueEngine (6.x)", () => {
  it("calculates per-token revenue and aggregates totals", () => {
    const engine = createRevenueEngine();
    const snapshots = createSnapshots(5);

    const result = engine.calculateMinuteRevenue(snapshots, 1);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const report = result.value;
      for (const ticker of TOKEN_TICKERS) {
        expect(report.perTokenFee[ticker]).toBeCloseTo(perTokenFee(5, 50), 6);
      }
      expect(report.totalFee).toBeCloseTo(perTokenFee(5, 50) * TOKEN_TICKERS.length, 6);
      expect(report.monthlyCost).toBeCloseTo(0.002 * 1440 * 30 * 1, 6);
      expect(report.netProfit).toBeCloseTo(report.totalFee - report.monthlyCost, 6);
    }
  });

  it("treats missing tokens as zero revenue", () => {
    const engine = createRevenueEngine();
    const partialSnapshots: TradeSnapshot[] = [{ ticker: "CO2", tradesPerMinute: 10, averageTradeUsd: 20 }];
    const result = engine.calculateMinuteRevenue(partialSnapshots, 1);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const report = result.value;
      expect(report.perTokenFee.CO2).toBeCloseTo(perTokenFee(10, 20), 6);
      for (const ticker of TOKEN_TICKERS.filter(t => t !== "CO2")) {
        expect(report.perTokenFee[ticker]).toBe(0);
      }
    }
  });

  it("caps negative inputs at zero", () => {
    const engine = createRevenueEngine();
    const snapshots: TradeSnapshot[] = [
      { ticker: "CO2", tradesPerMinute: -5, averageTradeUsd: 10 },
      { ticker: "ICE", tradesPerMinute: 5, averageTradeUsd: -10 },
    ];
    const result = engine.calculateMinuteRevenue(snapshots, 1);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const report = result.value;
      expect(report.perTokenFee.CO2).toBe(0);
      expect(report.perTokenFee.ICE).toBe(0);
    }
  });

  it("scales monthly cost by generation rate", () => {
    const engine = createRevenueEngine();
    const snapshots = createSnapshots(2);
    const result = engine.calculateMinuteRevenue(snapshots, 0.5);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const report = result.value;
      expect(report.monthlyCost).toBeCloseTo(0.002 * 1440 * 30 * 0.5, 6);
    }
  });
});
