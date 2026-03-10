/**
 * Image Utility Functions
 *
 * Provides reusable image manipulation utilities:
 * - ArrayBuffer to base64 data URL conversion
 * - Base64 to ArrayBuffer conversion
 * - Image format handling
 */

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

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
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = globalThis.btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Convert base64 string to ArrayBuffer
 *
 * Supports multiple environments:
 * - Node.js: Uses Buffer API
 * - Browser/Workers: Uses atob API
 *
 * @param base64 - Base64 encoded string (with or without data URL prefix)
 * @returns ArrayBuffer containing the decoded binary data
 * @throws Error if base64 decoding is not supported in the current environment
 *
 * @example
 * ```ts
 * const base64 = "iVBORw0KGgo...";
 * const buffer = base64ToArrayBuffer(base64);
 * // => ArrayBuffer { ... }
 * ```
 *
 * @example
 * ```ts
 * // Also handles data URLs
 * const dataUrl = "data:image/webp;base64,iVBORw0KGgo...";
 * const buffer = base64ToArrayBuffer(dataUrl);
 * // => ArrayBuffer { ... }
 * ```
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");

  if (typeof globalThis.atob === "function") {
    const binaryString = globalThis.atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return toArrayBuffer(bytes);
  }

  throw new Error("Base64 decoding not supported in this environment");
}
