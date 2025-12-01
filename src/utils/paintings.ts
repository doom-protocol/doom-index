import { env } from "@/env";

export function buildPublicR2Path(key: string): string {
  const normalized = key.replace(/^\/+/, "");

  if (env.NEXT_PUBLIC_R2_URL) {
    const baseUrl = env.NEXT_PUBLIC_R2_URL.replace(/\/+$/, "");

    // Check if URL already includes protocol or starts with slash (relative)
    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://") || baseUrl.startsWith("/")) {
      // Already has protocol or is relative, use as-is
      return `${baseUrl.replace(/\/+$/, "")}/${normalized}`;
    }

    const protocol = baseUrl.startsWith("localhost") ? "http" : "https";
    return `${protocol}://${baseUrl}/${normalized}`;
  }

  return `/api/r2/${normalized}`;
}

export function buildPaintingKey(dateString: string, filename: string): string {
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD or ISO timestamp.`);
  }

  const [, year, month, day] = dateMatch;
  const prefix = `images/${year}/${month}/${day}/`;
  return `${prefix}${filename}`;
}

export function isValidPaintingFilename(filename: string): boolean {
  const pattern = /^DOOM_\d{12}_[a-z0-9]{8}_[a-z0-9]{12}\.webp$/;
  return pattern.test(filename);
}

export function extractIdFromFilename(filename: string): string {
  return filename.replace(/\.webp$/, "");
}
