import type { ImageProvider } from "@/types/domain";
import { createMockImageProvider } from "./mock";
import { createRunwareProvider } from "./runware";

/**
 * Image Provider Factory
 * This module provides factory functions for creating image generation providers.
 * Currently supports Runware as the primary provider and a mock provider for testing.
 */

// Mock provider is for testing only
type ProviderNameWithMock = string;

/**
 * Creates the default Runware image provider
 * This is the primary provider used for all image generation
 */
export const createImageProvider = (): ImageProvider => createRunwareProvider();

/**
 * Resolve provider including mock (for testing only)
 */
export const resolveProviderWithMock = (name: ProviderNameWithMock): ImageProvider => {
  return name === "mock" ? createMockImageProvider() : createImageProvider();
};
