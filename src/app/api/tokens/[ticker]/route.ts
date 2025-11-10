import { NextResponse } from "next/server";
import { TOKEN_TICKERS, type TokenTicker } from "@/constants/token";
import { getJsonR2, resolveR2Bucket } from "@/lib/r2";
import { logger } from "@/utils/logger";
import type { TokenState } from "@/types/domain";

const isTokenTicker = (value: string): value is TokenTicker => TOKEN_TICKERS.includes(value as TokenTicker);

type RouteContext = {
  params: Promise<{ ticker: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  if (!isTokenTicker(ticker)) {
    return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  }

  const bucketResult = resolveR2Bucket();
  if (bucketResult.isErr()) {
    logger.error("api.token.resolve-bucket.error", {
      ticker,
      error: bucketResult.error,
    });
    return NextResponse.json({ error: bucketResult.error }, { status: 500 });
  }

  const bucket = bucketResult.value;
  const result = await getJsonR2<TokenState>(bucket, `state/${ticker}.json`);

  if (result.isErr()) {
    logger.error("api.token.error", { ticker, error: result.error });
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  const value = result.value;
  if (!value) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(value, { status: 200 });
}
