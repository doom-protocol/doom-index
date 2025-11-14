import { isBotUserAgent } from "@/utils/user-agent";
import { createVanillaTRPCClient } from "@/lib/trpc/vanilla-client";

// generate sessionId when Worker starts
const sessionId = crypto.randomUUID();

// Initialize tRPC client
const trpc = createVanillaTRPCClient();

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

    await trpc.viewer.register.mutate({
      sessionId,
      userAgent,
    });
  } catch {
    // ignore error (will retry in next heartbeat)
  }
}

async function remove(): Promise<void> {
  // Skip remove if this is not a valid browser request
  if (!isValidBrowserRequest()) {
    return;
  }

  try {
    await trpc.viewer.remove.mutate({
      sessionId,
    });
  } catch {
    // ignore error
  }
}

// Only send ping if this is a valid browser request
if (isValidBrowserRequest()) {
  // send ping immediately when Worker starts
  ping();

  // send heartbeat every 30 seconds
  const timer = setInterval(ping, 30_000);

  // clean up timer and remove viewer when Worker ends
  const cleanup = () => {
    clearInterval(timer);
    remove();
  };

  self.addEventListener("beforeunload", cleanup);
  self.addEventListener("pagehide", cleanup);
}
