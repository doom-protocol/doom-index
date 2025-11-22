/**
 * IPFS tRPC Router
 *
 * Provides Pinata signed URL generation for client-side direct uploads
 * Follows existing tRPC patterns with neverthrow Result types
 */

import { router, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { createSignedUploadUrlSchema } from "../schemas";
import { createPinataClient, type PinataClient } from "@/lib/pinata-client";

/**
 * IPFS Router
 *
 * Provides procedures for:
 * - Creating signed upload URLs for Pinata IPFS uploads
 */
export const ipfsRouter = router({
  /**
   * Create signed upload URL for Pinata
   *
   * Generates a 30-second signed URL that allows client-side direct upload
   * to Pinata without exposing the API key
   */
  createSignedUploadUrl: publicProcedure.input(createSignedUploadUrlSchema).mutation(async ({ input, ctx }) => {
    // Get Pinata client from context (for testing) or create new one
    const pinataClient: PinataClient =
      // @ts-expect-error - pinataClient is injected for testing
      ctx.pinataClient ?? createPinataClient();

    // Create signed URL with 30 second expiration
    const result = await pinataClient.createSignedUploadUrl({
      expires: 30,
      name: input.filename,
      keyvalues: input.keyvalues,
    });

    if (result.isErr()) {
      ctx.logger.error("trpc.ipfs.createSignedUploadUrl.error", {
        error: result.error,
        filename: input.filename,
      });

      throw new TRPCError({
        code: result.error.type === "ConfigurationError" ? "INTERNAL_SERVER_ERROR" : "INTERNAL_SERVER_ERROR",
        message: result.error.message,
        cause: result.error,
      });
    }

    ctx.logger.info("trpc.ipfs.createSignedUploadUrl.success", {
      filename: input.filename,
      expires: result.value.expires,
    });

    return {
      url: result.value.url,
      expires: result.value.expires,
    };
  }),
});
