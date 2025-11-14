import type { Context } from "@/server/trpc/context";
import { logger } from "@/utils/logger";

export function createMockContext(overrides?: Partial<Context>): Context {
  return {
    headers: new Headers(),
    logger,
    ...overrides,
  };
}
