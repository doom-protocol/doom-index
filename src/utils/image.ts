/**
 * Image Utility Functions
 *
 * Provides reusable image manipulation utilities:
 * - ArrayBuffer to base64 data URL conversion
 * - Image format handling
 */

/**
 * Convert ArrayBuffer to base64 data URL
 *
 * @param buffer - Image binary data as ArrayBuffer
 * @param mimeType - MIME type (e.g., "image/webp", "image/png")
 * @returns Data URL string in format "data:{mimeType};base64,{base64}"
 *
 * @example
 * ```ts
 * const buffer = await fetch(imageUrl).then(r => r.arrayBuffer());
 * const dataUrl = arrayBufferToDataUrl(buffer, "image/webp");
 * // => "data:image/webp;base64,iVBORw0KGgo..."
 * ```
 */
export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}
