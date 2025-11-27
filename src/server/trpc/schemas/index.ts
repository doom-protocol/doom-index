import * as v from "valibot";

/**
 * Legacy Token Ticker Schema
 * @deprecated This schema is for backward compatibility only.
 * The legacy 8-token system has been removed.
 */
export const tokenTickerSchema = v.string();

// Viewer Schemas
export const viewerRegisterSchema = v.object({
  sessionId: v.pipe(v.string(), v.minLength(1, "Session ID is required")),
  userAgent: v.optional(v.string()),
});

export const viewerRemoveSchema = v.object({
  sessionId: v.pipe(v.string(), v.minLength(1, "Session ID is required")),
});

// Token Schemas
/**
 * Legacy token state schema
 * @deprecated This schema is for backward compatibility only.
 */
export const tokenGetStateSchema = v.object({
  ticker: tokenTickerSchema,
});

// R2 Schemas
export const r2GetObjectSchema = v.object({
  key: v.pipe(v.array(v.pipe(v.string(), v.minLength(1))), v.minLength(1, "At least one key segment is required")),
});

// Paintings Schemas
export const paintingsListSchema = v.pipe(
  v.object({
    limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))),
    cursor: v.optional(v.string()),
    from: v.optional(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD"))),
    to: v.optional(v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD"))),
  }),
  v.forward(
    v.check(data => {
      if (data.from && data.to) {
        const start = new Date(data.from);
        const end = new Date(data.to);
        return start <= end;
      }
      return true;
    }, "from must be before or equal to to"),
    ["from"],
  ),
);

// IPFS Schemas
export const createSignedUploadUrlSchema = v.object({
  filename: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
  contentType: v.picklist(["application/octet-stream", "application/json"]),
  keyvalues: v.optional(
    v.object({
      walletAddress: v.optional(v.string()),
      timestamp: v.string(),
      paintingHash: v.string(),
      network: v.picklist(["devnet", "mainnet-beta"]),
    }),
  ),
});
