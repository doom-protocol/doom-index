import { ok, err } from "neverthrow";
import { Runware } from "@runware/sdk-js";
import { env } from "@/env";
import type { ImageProvider, ImageRequest } from "@/types/domain";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

/**
 * Extended Runware type with runtime methods
 */
type RunwareInstance = InstanceType<typeof Runware> & {
  connect?: () => Promise<void>;
  requestImages?: (params: unknown) => Promise<unknown[]>;
  disconnect: () => Promise<void>;
};

/**
 * Runware SDK Provider for Image Generation
 * High-performance image generation with WebSocket support
 * @see https://runware.ai/docs/en/libraries/javascript
 */
export const createRunwareSdkProvider = (): ImageProvider => ({
  name: "runware-sdk",

  async generate(input: ImageRequest) {
    const apiKey = env.RUNWARE_API_KEY;
    if (!apiKey) {
      return err({
        type: "ValidationError",
        message: "RUNWARE_API_KEY is not configured",
      } as AppError);
    }

    let runware: RunwareInstance | null = null;

    try {
      logger.debug("runware-sdk.generate.start", {
        prompt: input.prompt.substring(0, 100),
        size: `${input.width}x${input.height}`,
        seed: input.seed,
      });

      // Initialize Runware SDK
      runware = new Runware({ apiKey }) as RunwareInstance;

      // Connect if the method exists (client-side only)
      if (runware?.connect) {
        await runware.connect();
      }

      // Convert hex seed to integer (Runware expects integer seed)
      const seedInt = input.seed ? parseInt(input.seed.substring(0, 8), 16) : undefined;

      // Use provided model or default to Stable Diffusion XL
      const model = input.model || "runware:100@1";

      // Generate image using Runware SDK
      if (!runware?.requestImages) {
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: "Runware SDK requestImages method not available",
        } as AppError);
      }

      const images = (await runware.requestImages({
        positivePrompt: input.prompt,
        negativePrompt: input.negative,
        height: input.height,
        width: input.width,
        model,
        numberResults: 1,
        outputFormat: input.format === "png" ? "PNG" : "WEBP",
        outputType: "base64Data",
        uploadEndpoint: undefined, // Return base64 instead of uploading
        ...(seedInt !== undefined && { seed: seedInt }),
      })) as Array<{ taskUUID: string; imageBase64Data?: string }>;

      if (!images || images.length === 0) {
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: "No image generated",
        } as AppError);
      }

      const imageData = images[0];
      logger.info("runware-sdk.generate.success", {
        taskUUID: imageData.taskUUID,
        model,
        size: imageData.imageBase64Data?.length || 0,
      });

      // Convert base64 to ArrayBuffer
      if (!imageData.imageBase64Data) {
        return err({
          type: "ExternalApiError",
          provider: "ImageProvider",
          message: "No image data in response",
        } as AppError);
      }

      const base64Data = imageData.imageBase64Data.replace(/^data:image\/\w+;base64,/, "");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const imageBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

      return ok({
        imageBuffer,
        providerMeta: {
          provider: "runware-sdk",
          taskUUID: imageData.taskUUID,
          model,
          seed: seedInt,
        },
      });
    } catch (error) {
      logger.error("runware-sdk.generate.error", { error });
      return err({
        type: "ExternalApiError",
        provider: "ImageProvider",
        message: error instanceof Error ? error.message : String(error),
      } as AppError);
    } finally {
      // Disconnect from Runware
      if (runware) {
        try {
          await runware.disconnect();
        } catch (disconnectError) {
          logger.warn("runware-sdk.disconnect.error", { error: disconnectError });
        }
      }
    }
  },
});
