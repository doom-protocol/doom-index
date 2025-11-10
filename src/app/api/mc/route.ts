import { NextResponse } from "next/server";
import { roundMc4 } from "@/lib/round";
import { createServicesForNextjs } from "@/services/container";
import { TOKEN_TICKERS } from "@/constants/token";
import { logger } from "@/utils/logger";
import { env } from "@/env";

export const runtime = "edge";

const zeroMap = TOKEN_TICKERS.reduce(
  (acc, ticker) => {
    acc[ticker] = 0;
    return acc;
  },
  {} as Record<(typeof TOKEN_TICKERS)[number], number>,
);

export async function GET() {
  const { marketCapService } = createServicesForNextjs(env.R2_PUBLIC_DOMAIN);
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
  const rounded = roundMc4(result.value);
  return NextResponse.json(
    {
      tokens: rounded,
      generatedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}
