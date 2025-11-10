import { NextResponse } from "next/server";
import logger from "@/utils/logger";
import { getServices } from "@/services/container";

export const runtime = "edge";

export async function GET() {
  const { generationService } = getServices();
  const result = await generationService.evaluateMinute();
  if (result.isErr()) {
    logger.error("api.cron.error", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  const evaluation = result.value;
  return NextResponse.json(
    {
      ok: true,
      status: evaluation.status,
      hash: evaluation.hash,
      imageUrl: evaluation.imageUrl,
      paramsHash: evaluation.paramsHash,
      seed: evaluation.seed,
      revenue: evaluation.revenue ?? null,
    },
    { status: 200 },
  );
}
