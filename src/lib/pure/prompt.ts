import { TOKEN_AXIS_MAP, TOKEN_TICKERS, MARKET_CAP_ROUND_DECIMALS, type McMapRounded } from "@/constants/token";
import type { VisualParams } from "@/lib/pure/mapping";
import type { PromptVersion } from "@/types/prompt";

const formatTokenSnapshot = (mcRounded: McMapRounded): string =>
  TOKEN_TICKERS.map(ticker => `${ticker}=${mcRounded[ticker].toFixed(MARKET_CAP_ROUND_DECIMALS)}`).join(", ");

const formatVisualParams = (visualParams: VisualParams): string =>
  Object.entries(visualParams)
    .map(([key, value]) => `${key}=${value.toFixed(2)}`)
    .join(", ");

const formatInfluenceNarrative = (mcRounded: McMapRounded): string =>
  TOKEN_TICKERS.map(ticker => {
    const [primary, secondary] = TOKEN_AXIS_MAP[ticker];
    return `${ticker.toLowerCase()}→${primary}/${secondary}=${mcRounded[ticker].toFixed(MARKET_CAP_ROUND_DECIMALS)}`;
  }).join("; ");

export type PromptContext = {
  version: PromptVersion;
  mcRounded: McMapRounded;
  visualParams: VisualParams;
  paramsHash: string;
  seed: string;
  minuteBucket: string;
};

export function buildPromptText(context: PromptContext): string {
  const { version, mcRounded, visualParams, paramsHash, seed, minuteBucket } = context;
  const snapshot = formatTokenSnapshot(mcRounded);
  const params = formatVisualParams(visualParams);
  const narrative = formatInfluenceNarrative(mcRounded);

  return [
    version.basePrompt.trim(),
    `Data snapshot [${minuteBucket}]: ${snapshot}.`,
    `Influence narrative: ${narrative}.`,
    `Visual parameters: ${params}.`,
    `Deterministic controls: paramsHash=${paramsHash}, seed=${seed}.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
