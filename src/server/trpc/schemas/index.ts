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
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Expected YYYY-MM-DD")
      .optional(),
  })
  .refine(
    data => {
      if (data.startDate && data.endDate) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        return start <= end;
      }
      return true;
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["startDate"],
    },
  );
