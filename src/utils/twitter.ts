const DOOM_INDEX_URL = "https://doomindex.fun";

interface TweetIntentOptions {
  shareUrl?: string;
  lines?: string[];
}

const DEFAULT_TWEET_LINES = [
  "Just touched this piece inside the DOOM Index gallery.",
  "Market-driven art reacting in real time 🤯",
  "$DOOM #doomindex",
];

const TWITTER_INTENT_URL = "https://x.com/intent/post";

/**
 * Build share URL with cache-busting timestamp parameter.
 * This forces Twitter to refetch OGP metadata when URL is shared.
 */
const buildShareUrlWithCacheBuster = (baseUrl: string): string => {
  const url = new URL(baseUrl);
  url.searchParams.set("t", Date.now().toString(36));
  return url.toString();
};

const buildTweetIntentUrl = ({ shareUrl, lines = DEFAULT_TWEET_LINES }: TweetIntentOptions): string => {
  const url = new URL(TWITTER_INTENT_URL);
  const candidateLines = [...lines];

  if (shareUrl) {
    candidateLines.push(shareUrl);
  }

  const deduplicatedLines = candidateLines.reduce<string[]>((acc, line) => {
    const normalized = line.trim();
    if (!normalized) {
      return acc;
    }

    const alreadyExists = acc.some(existing => existing.trim() === normalized);
    if (alreadyExists) {
      return acc;
    }

    acc.push(line);
    return acc;
  }, []);

  url.searchParams.set("text", deduplicatedLines.join("\n"));
  return url.toString();
};

export const openTweetIntent = (options?: TweetIntentOptions): void => {
  if (typeof window === "undefined") {
    return;
  }

  const { shareUrl, ...rest } = options ?? {};
  const finalShareUrl = buildShareUrlWithCacheBuster(shareUrl ?? DOOM_INDEX_URL);
  const intentUrl = buildTweetIntentUrl({
    shareUrl: finalShareUrl,
    ...rest,
  });

  window.open(intentUrl, "_blank", "noopener,noreferrer");
};
