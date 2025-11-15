import { err, ok, Result } from "neverthrow";
import type { StateService, GlobalState, TokenState } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { putJsonR2, getJsonR2, resolveBucketOrThrow } from "@/lib/r2";

type StateServiceDeps = {
  r2Bucket?: R2Bucket;
};

const stateKeys = {
  globalState: () => "state/global.json",
  tokenState: (ticker: string) => `state/${ticker}.json`,
};

/**
 * Create state service for R2 storage operations
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 */
export function createStateService({ r2Bucket }: StateServiceDeps = {}): StateService {
  const bucket = resolveBucketOrThrow({ r2Bucket });

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

  return {
    readGlobalState,
    writeGlobalState,
    readTokenState,
    writeTokenStates,
  };
}
