import { isBotUserAgent } from "@/utils/user-agent";

const endpoint = "/api/viewer";

// generate sessionId when Worker starts
const sessionId = crypto.randomUUID();

/**
 * Check if this is a valid browser request
 */
function isValidBrowserRequest(): boolean {
  // Check if navigator is available (should be in Web Worker context)
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isBot = isBotUserAgent(userAgent);
  return !isBot;
}

async function ping(): Promise<void> {
  // Skip ping if this is not a valid browser request
  if (!isValidBrowserRequest()) {
    return;
  }

  try {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
    const body = JSON.stringify({ sessionId, userAgent });

    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // ignore error (will retry in next heartbeat)
  }
}

// Only send ping if this is a valid browser request
if (isValidBrowserRequest()) {
  // send ping immediately when Worker starts
  ping();

  // send heartbeat every 30 seconds
  const timer = setInterval(ping, 30_000);

  // clean up timer when Worker ends (usually not needed, but just in case)
  self.addEventListener("beforeunload", () => {
    clearInterval(timer);
  });
}
