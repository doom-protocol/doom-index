/**
 * User Agent Detection Utilities
 *
 * Provides functions to detect bots and crawlers from user agent strings.
 */

/**
 * Bot/crawler patterns to detect
 */
const BOT_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "facebookexternalhit",
  "twitterbot",
  "discordbot",
  "linkedinbot",
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "sogou",
  "exabot",
  "facebot",
  "ia_archiver",
] as const;

/**
 * Check if user agent indicates a bot or crawler
 *
 * @param userAgent - User agent string to check (can be null or undefined)
 * @returns true if user agent is empty or matches bot patterns
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "") {
    return true; // empty user agent is suspicious
  }

  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}
