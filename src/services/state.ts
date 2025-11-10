import { err, ok, Result } from "neverthrow";
import type { StateService, GlobalState, TokenState, RevenueReport } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { putJsonR2, getJsonR2, putImageR2 } from "@/lib/r2";

type StateServiceDeps = {
  r2Bucket: R2Bucket;
  r2PublicDomain: string;
};

const validationError = (message: string, details?: unknown): AppError => ({
  type: "ValidationError",
  message,
  details,
});

const stateKeys = {
  globalState: () => "state/global.json",
  tokenState: (ticker: string) => `state/${ticker}.json`,
  revenue: (minuteIso: string) => `revenue/${minuteIso}.json`,
};

export function createStateService({ r2Bucket, r2PublicDomain }: StateServiceDeps): StateService {
  async function readGlobalState(): Promise<Result<GlobalState | null, AppError>> {
    return getJsonR2<GlobalState>(r2Bucket, stateKeys.globalState());
  }

  async function writeGlobalState(state: GlobalState): Promise<Result<void, AppError>> {
    return putJsonR2(r2Bucket, stateKeys.globalState(), state);
  }

  async function readTokenState(ticker: string): Promise<Result<TokenState | null, AppError>> {
    return getJsonR2<TokenState>(r2Bucket, stateKeys.tokenState(ticker));
  }

  async function writeTokenStates(states: TokenState[]): Promise<Result<void, AppError>> {
    // R2 は並列書き込みをサポートしているため、Promise.allSettled を使用
    const results = await Promise.allSettled(
      states.map(state => putJsonR2(r2Bucket, stateKeys.tokenState(state.ticker), state)),
    );

    // すべての結果を確認し、エラーがあれば最初のエラーを返す
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.isErr()) {
        return err(result.value.error);
      }
    }

    return ok(undefined);
  }

  async function storeImage(key: string, buf: ArrayBuffer): Promise<Result<string, AppError>> {
    return putImageR2(r2Bucket, key, buf, "image/webp", r2PublicDomain);
  }

  async function writeRevenue(report: RevenueReport, minuteIso: string): Promise<Result<void, AppError>> {
    return putJsonR2(r2Bucket, stateKeys.revenue(minuteIso), report);
  }

  async function readRevenue(minuteIso: string): Promise<Result<RevenueReport | null, AppError>> {
    return getJsonR2<RevenueReport>(r2Bucket, stateKeys.revenue(minuteIso));
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
