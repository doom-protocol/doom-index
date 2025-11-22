import { DEV_FUN_URL } from "@/constants";

interface TweetIntentOptions {
  shareUrl?: string;
  lines?: string[];
}

const DEFAULT_TWEET_LINES = [
  "Just touched this piece inside the DOOM Index gallery.",
  "Market-driven art reacting in real time 🤯",
  "$DOOM #doomindex #devfun #pumpfun",
];

const TWITTER_INTENT_URL = "https://twitter.com/intent/tweet";

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

export const openTweetIntent = (options?: TweetIntentOptions) => {
  if (typeof window === "undefined") {
    return;
  }

  const { shareUrl = DEV_FUN_URL, ...rest } = options ?? {};
  const intentUrl = buildTweetIntentUrl({
    shareUrl,
    ...rest,
  });

  window.open(intentUrl, "_blank", "noopener,noreferrer");
};
