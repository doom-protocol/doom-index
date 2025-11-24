import { z } from "zod";

/**
 * Legacy Token Ticker Schema
 * @deprecated This schema is for backward compatibility only.
 * The legacy 8-token system has been removed.
 */
export const tokenTickerSchema = z.string();

// Viewer Schemas
export const viewerRegisterSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  userAgent: z.string().optional(),
});

export const viewerRemoveSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
});

// Token Schemas
/**
 * Legacy token state schema
 * @deprecated This schema is for backward compatibility only.
 */
export const tokenGetStateSchema = z.object({
  ticker: tokenTickerSchema,
});

// R2 Schemas
export const r2GetObjectSchema = z.object({
  key: z.array(z.string().min(1)).min(1, "At least one key segment is required"),
});

// Paintings Schemas
export const paintingsListSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional(),
    cursor: z.string().optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD")
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD")
      .optional(),
  })
  .refine(
    data => {
      if (data.from && data.to) {
        const start = new Date(data.from);
        const end = new Date(data.to);
        return start <= end;
      }
      return true;
    },
    {
      message: "from must be before or equal to to",
      path: ["from", "to"],
    },
  );

// IPFS Schemas
export const createSignedUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(["application/octet-stream", "application/json"]),
  keyvalues: z
    .object({
      walletAddress: z.string().optional(),
      timestamp: z.string(),
      paintingHash: z.string(),
      network: z.enum(["devnet", "mainnet-beta"]),
    })
    .optional(),
});
