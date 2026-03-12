import * as v from "valibot";

// Viewer Schemas
export const viewerRegisterSchema = v.object({
  sessionId: v.pipe(v.string(), v.minLength(1, "Session ID is required")),
  userAgent: v.optional(v.string()),
});

export const viewerRemoveSchema = v.object({
  sessionId: v.pipe(v.string(), v.minLength(1, "Session ID is required")),
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
    v.check((data) => {
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

export const prepareMintMetadataSchema = v.object({
  paintingId: v.pipe(v.string(), v.minLength(1, "paintingId is required")),
  tokenId: v.pipe(v.number(), v.integer(), v.minValue(0, "tokenId must be positive")),
});
