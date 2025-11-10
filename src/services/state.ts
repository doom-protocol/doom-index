import { err, ok, Result } from "neverthrow";
import type { StateService, GlobalState, TokenState, RevenueReport } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { putJsonR2, getJsonR2, putImageR2, resolveR2Bucket } from "@/lib/r2";

type StateServiceDeps = {
  r2Bucket?: R2Bucket;
};

const stateKeys = {
  globalState: () => "state/global.json",
  tokenState: (ticker: string) => `state/${ticker}.json`,
  revenue: (minuteIso: string) => `revenue/${minuteIso}.json`,
};

const buildPublicPath = (key: string): string => {
  const normalized = key.replace(/^\/+/, "");
  const encoded = normalized
    .split("/")
    .map(segment => encodeURIComponent(segment))
    .join("/");
  return `/api/r2/${encoded}`;
};

/**
 * Create state service for R2 storage operations
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 */
export function createStateService({ r2Bucket }: StateServiceDeps = {}): StateService {
  let bucket: R2Bucket;
  if (r2Bucket) {
    bucket = r2Bucket;
  } else {
    const bucketResult = resolveR2Bucket();
    if (bucketResult.isErr()) {
      throw new Error(`Failed to resolve R2 bucket: ${bucketResult.error.message}`);
    }
    bucket = bucketResult.value;
  }

  async function readGlobalState(): Promise<Result<GlobalState | null, AppError>> {
    return getJsonR2<GlobalState>(bucket, stateKeys.globalState());
  }

  async function writeGlobalState(state: GlobalState): Promise<Result<void, AppError>> {
    return putJsonR2(bucket, stateKeys.globalState(), state);
  }

  async function readTokenState(ticker: string): Promise<Result<TokenState | null, AppError>> {
    return getJsonR2<TokenState>(bucket, stateKeys.tokenState(ticker));
  }

  async function writeTokenStates(states: TokenState[]): Promise<Result<void, AppError>> {
    // Use Promise.allSettled since R2 supports parallel writes
    const results = await Promise.allSettled(
      states.map(state => putJsonR2(bucket, stateKeys.tokenState(state.ticker), state)),
    );

    // Check all results and return the first error if any
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.isErr()) {
        return err(result.value.error);
      }
    }

    return ok(undefined);
  }

  async function storeImage(key: string, buf: ArrayBuffer): Promise<Result<string, AppError>> {
    const putResult = await putImageR2(bucket, key, buf, "image/webp");
    if (putResult.isErr()) {
      return err(putResult.error);
    }
    return ok(buildPublicPath(key));
  }

  async function writeRevenue(report: RevenueReport, minuteIso: string): Promise<Result<void, AppError>> {
    return putJsonR2(bucket, stateKeys.revenue(minuteIso), report);
  }

  async function readRevenue(minuteIso: string): Promise<Result<RevenueReport | null, AppError>> {
    return getJsonR2<RevenueReport>(bucket, stateKeys.revenue(minuteIso));
  }

  return {
    readGlobalState,
    writeGlobalState,
    readTokenState,
    writeTokenStates,
    storeImage,
    writeRevenue,
    readRevenue,
  };
}
