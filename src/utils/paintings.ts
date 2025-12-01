/**
 * Simple archive utility functions
 * For complex validation and business logic, see lib/pure/archive-*.ts
 */

export function buildPublicR2Path(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  // Always use relative path via API route to ensure same-origin access
  // and avoid CORS/mixed-content issues
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
