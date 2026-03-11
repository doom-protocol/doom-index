import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { clearLogCalls, createLoggerMockFactory, findLogCall } from "../../../mocks/logger";

const { mockFactory: loggerMockFactory, calls, mockLogger } = createLoggerMockFactory();
void mock.module("@/utils/logger", loggerMockFactory);

const missingTableError = Object.assign(new Error("D1_ERROR: no such table: paintings: SQLITE_ERROR"), {
  cause: new Error("no such table: paintings: SQLITE_ERROR"),
});

void mock.module("@/server/db", () => ({
  getDB: async () => {
    await Promise.resolve();
    throw missingTableError;
  },
}));

describe("Paintings repository logging", () => {
  beforeEach(() => {
    clearLogCalls(calls);
  });

  afterEach(() => {
    mock.restore();
  });

  it("downgrades missing-table list failures to debug logs", async () => {
    const { createPaintingsRepository } = await import("@/server/repositories/paintings-repository");
    const repository = createPaintingsRepository({
      log: mockLogger as unknown as typeof import("@/utils/logger").logger,
    });

    const result = await repository.list({ limit: 1 });

    expect(result.isErr()).toBe(true);
    expect(findLogCall(calls, "debug", "archive-repo.list.missing-table")).toBeDefined();
    expect(findLogCall(calls, "error", "archive-repo.list.error")).toBeUndefined();
  });
});
