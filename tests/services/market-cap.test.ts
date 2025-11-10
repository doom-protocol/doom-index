import { describe, it, expect, mock } from "bun:test";
import { createMarketCapService } from "@/services/market-cap";
import { TOKEN_CONFIG_MAP, TOKEN_TICKERS, type TokenConfig } from "@/constants/token";
import { LogLevel } from "@/utils/logger";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const createLoggerMock = () => ({
  log: mock(() => undefined),
  debug: mock(() => undefined),
  info: mock(() => undefined),
  warn: mock(() => undefined),
  error: mock(() => undefined),
  getCurrentLevel: mock(() => LogLevel.INFO),
  getLevels: mock(() => []),
});

type FetchMock = ReturnType<typeof mock<(input: string | URL) => Promise<Response>>>;

const createService = (fetchStub: FetchMock, tokens?: TokenConfig[]) =>
  createMarketCapService({
    fetch: fetchStub as unknown as typeof fetch,
    log: createLoggerMock(),
    tokens,
  });

describe("MarketCapService 2.x", () => {
  it("returns Result.ok with market caps computed from the highest-liquidity pair", async () => {
    const fetchStub = mock(async () =>
      jsonResponse({
        pairs: [
          { liquidity: { usd: 10_000 }, priceUsd: "2.5" },
          { liquidity: { usd: 50_000 }, priceUsd: "2.0" }, // selected
        ],
      }),
    );

    const service = createService(fetchStub);
    const result = await service.getMcMap();

    expect(fetchStub.mock.calls.length).toBe(TOKEN_TICKERS.length);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const mc = result.value;
      const expected = TOKEN_CONFIG_MAP.CO2.supply * 2;
      expect(mc.CO2).toBe(expected);
    }
  });

  it("falls back to 0 per token on upstream non-200 responses and logs errors", async () => {
    const fetchStub = mock(async () => new Response("error", { status: 500 }));
    const logger = createLoggerMock();
    const service = createMarketCapService({
      fetch: fetchStub as unknown as typeof fetch,
      log: logger,
    });

    const result = await service.getMcMap();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const mc = result.value;
      for (const ticker of TOKEN_TICKERS) {
        expect(mc[ticker]).toBe(0);
      }
    }
    expect(logger.error.mock.calls.length).toBeGreaterThan(0);
  });

  it("treats exceptions while fetching as recoverable and records zeros", async () => {
    const fetchStub = mock(async () => {
      throw new Error("network");
    });
    const logger = createLoggerMock();
    const service = createMarketCapService({
      fetch: fetchStub as unknown as typeof fetch,
      log: logger,
    });

    const result = await service.getMcMap();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      for (const value of Object.values(result.value)) {
        expect(value).toBe(0);
      }
    }
    expect(logger.error.mock.calls.length).toBe(TOKEN_TICKERS.length);
  });

  it("handles custom token definitions with missing supply by forcing zero market cap", async () => {
    const fetchStub = mock(async () =>
      jsonResponse({
        pairs: [{ liquidity: { usd: 100_000 }, priceUsd: "3.0" }],
      }),
    );
    const logger = createLoggerMock();
    const tokens: TokenConfig[] = [
      {
        ticker: "CO2",
        address: "ADDR",
        supply: 0,
        axes: ["fogDensity", "skyTint"],
        normalization: { min: 0, max: 1 },
      },
    ];

    const service = createMarketCapService({
      fetch: fetchStub as unknown as typeof fetch,
      log: logger,
      tokens,
    });

    const result = await service.getMcMap();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.CO2).toBe(0);
    }
    expect(logger.warn.mock.calls.length).toBeGreaterThan(0);
  });
});
