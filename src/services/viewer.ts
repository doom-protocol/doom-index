import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { putKv, deleteKv, listKv } from "@/lib/kv";

const VIEWER_KEY_PREFIX = "viewer:";
const VIEWER_TTL_SECONDS = 60;

type ViewerServiceDeps = {
  kvNamespace: KVNamespace;
  log?: typeof logger;
};

type ViewerService = {
  registerViewer(sessionId: string): Promise<Result<void, AppError>>;
  updateViewer(sessionId: string): Promise<Result<void, AppError>>;
  removeViewer(sessionId: string): Promise<Result<void, AppError>>;
  hasActiveViewer(): Promise<Result<boolean, AppError>>;
  countActiveViewers(): Promise<Result<number, AppError>>;
};

export function createViewerService({ kvNamespace, log = logger }: ViewerServiceDeps): ViewerService {
  function getViewerKey(sessionId: string): string {
    return `${VIEWER_KEY_PREFIX}${sessionId}`;
  }

  async function registerViewer(sessionId: string): Promise<Result<void, AppError>> {
    const key = getViewerKey(sessionId);
    const result = await putKv(kvNamespace, key, "1", {
      expirationTtl: VIEWER_TTL_SECONDS,
    });
    if (result.isErr()) {
      return result;
    }
    log.debug("viewer.service.register", { sessionId, key });
    return ok(undefined);
  }

  async function updateViewer(sessionId: string): Promise<Result<void, AppError>> {
    // updateViewer is the same as registerViewer (KV.put to update TTL)
    return registerViewer(sessionId);
  }

  async function removeViewer(sessionId: string): Promise<Result<void, AppError>> {
    const key = getViewerKey(sessionId);
    const result = await deleteKv(kvNamespace, key);
    if (result.isErr()) {
      return result;
    }
    log.debug("viewer.service.remove", { sessionId, key });
    return ok(undefined);
  }

  async function hasActiveViewer(): Promise<Result<boolean, AppError>> {
    const listResult = await listKv(kvNamespace, VIEWER_KEY_PREFIX, 10);
    if (listResult.isErr()) {
      return err(listResult.error);
    }

    const keys = listResult.value.keys;
    if (keys.length === 0) {
      log.debug("viewer.service.check", { hasViewer: false });
      return ok(false);
    }

    // Check expiration field from list() response
    // expiration is in absolute Unix timestamp format (even if set with TTL)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const hasActiveViewer = keys.some(keyInfo => {
      // If expiration is not set, consider it as active (shouldn't happen with our TTL)
      if (keyInfo.expiration === undefined) {
        return true;
      }
      // Check if expiration is in the future
      return keyInfo.expiration > nowSeconds;
    });

    log.debug("viewer.service.check", {
      hasViewer: hasActiveViewer,
      checkedKeys: keys.length,
    });
    return ok(hasActiveViewer);
  }

  async function countActiveViewers(): Promise<Result<number, AppError>> {
    const nowSeconds = Math.floor(Date.now() / 1000);
    let totalCount = 0;
    let cursor: string | undefined = undefined;
    const limit = 1000; // Maximum keys per page

    // Iterate through all pages until list_complete is true
    while (true) {
      const listResult = await listKv(kvNamespace, VIEWER_KEY_PREFIX, limit, cursor);
      if (listResult.isErr()) {
        return err(listResult.error);
      }

      const result = listResult.value;
      const keys = result.keys;

      // Count active viewers (not expired)
      const activeCount = keys.filter(keyInfo => {
        // If expiration is not set, consider it as active (shouldn't happen with our TTL)
        if (keyInfo.expiration === undefined) {
          return true;
        }
        // Check if expiration is in the future
        return keyInfo.expiration > nowSeconds;
      }).length;

      totalCount += activeCount;

      // If list is complete, we're done
      if (result.list_complete) {
        break;
      }

      // Otherwise, continue with the cursor
      if ("cursor" in result && result.cursor) {
        cursor = result.cursor;
      } else {
        // No cursor but list is not complete - this shouldn't happen, but break to avoid infinite loop
        log.debug("viewer.service.count", {
          warning: "list_complete is false but no cursor provided",
          totalCount,
        });
        break;
      }
    }

    log.debug("viewer.service.count", {
      count: totalCount,
    });

    return ok(totalCount);
  }

  return {
    registerViewer,
    updateViewer,
    removeViewer,
    hasActiveViewer,
    countActiveViewers,
  };
}
