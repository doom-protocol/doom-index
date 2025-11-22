import type { ImageProvider } from "@/types/domain";
import { createRunwareProvider } from "./runware";
import { createMockImageProvider } from "./mock";

/**
 * Image Provider Factory
 * This module provides factory functions for creating image generation providers.
 * Currently supports Runware as the primary provider and a mock provider for testing.
 */

// Mock provider is for testing only
type ProviderNameWithMock = "mock";

/**
 * Creates the default Runware image provider
 * This is the primary provider used for all image generation
 */
export const createImageProvider = (): ImageProvider => createRunwareProvider();

/**
 * Resolve provider including mock (for testing only)
 */
export const resolveProviderWithMock = (name: ProviderNameWithMock): ImageProvider => {
  if (name === "mock") {
    return createMockImageProvider();
  }
  // Fallback to default provider
  return createImageProvider();
};
