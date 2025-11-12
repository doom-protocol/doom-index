import { NextResponse } from "next/server";
import { roundMc } from "@/lib/round";
import { createMarketCapService } from "@/services/market-cap";
import { TOKEN_TICKERS } from "@/constants/token";
import { logger } from "@/utils/logger";

const zeroMap = TOKEN_TICKERS.reduce(
  (acc, ticker) => {
    acc[ticker] = 0;
    return acc;
  },
  {} as Record<(typeof TOKEN_TICKERS)[number], number>,
);

export async function GET() {
  const marketCapService = createMarketCapService({ fetch, log: logger });
  const result = await marketCapService.getMcMap();
  if (result.isErr()) {
    logger.error("api.mc.error", result.error);
    return NextResponse.json(
      {
        tokens: zeroMap,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
  const rounded = roundMc(result.value);
  return NextResponse.json(
    {
      tokens: rounded,
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}
