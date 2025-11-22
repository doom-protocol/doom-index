// Standalone Web Worker for viewer tracking
import { createVanillaTRPCClient } from "@/lib/trpc/vanilla-client";

const VIEWER_HEARTBEAT_INTERVAL = 60_000; // Heartbeat every 60 seconds

// Debug logging helper
function debugLog(message: string, data?: unknown) {
  console.log(`[ViewerWorker] ${message}`, data ?? "");
}

// Generate sessionId when Worker starts
function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const sessionId = generateSessionId();
debugLog("Worker session ID generated", { sessionId });

// Simple bot detection
function isBotUserAgent(userAgent: string): boolean {
  const botPatterns = ["bot", "spider", "crawler", "scraper", "headless", "chrome-headless", "phantomjs", "selenium"];
  return botPatterns.some(pattern => userAgent.toLowerCase().includes(pattern));
}

// Initialize tRPC client (use self.location in Worker context)
const trpc = createVanillaTRPCClient({
  baseUrl: self.location.origin,
});

/**
 * Check if this is a valid browser request
 */
function isValidBrowserRequest(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent;
  const isBot = isBotUserAgent(userAgent);
  return !isBot;
}

async function ping() {
  if (!isValidBrowserRequest()) {
    debugLog("Ping skipped - invalid browser");
    return;
  }

  if (!sessionId) {
    debugLog("ERROR: sessionId is not available!");
    return;
  }

  try {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
    const pingData = {
      sessionId,
      userAgent,
    };

    debugLog("Sending ping with data", pingData);

    await trpc.viewer.register.mutate(pingData);

    debugLog("Heartbeat sent successfully", { sessionId });
  } catch (error) {
    debugLog("Heartbeat failed", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function remove() {
  if (!isValidBrowserRequest()) return;
  try {
    await trpc.viewer.remove.mutate({ sessionId });
  } catch (error) {
    debugLog("Remove failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Setup tRPC subscription for viewer count updates
function setupViewerCountSubscription(retryCount = 0) {
  const maxRetries = 10;
  const baseDelay = 1000; // 1 second base delay
  const maxDelay = 30000; // Maximum 30 seconds

  // Calculate exponential backoff delay
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);

  debugLog(`Connecting to tRPC viewer count subscription (attempt ${retryCount + 1})`);

  try {
    const subscription = trpc.viewer.onCountUpdate.subscribe(undefined, {
      onData: data => {
        debugLog("Received count update from tRPC", data.count);
        // Reset retry count on successful data reception
        retryCount = 0;
        // Forward to main thread
        self.postMessage({
          type: "viewer-count",
          count: data.count,
          updatedAt: data.timestamp,
        });
      },
      onError: error => {
        debugLog("tRPC subscription error", {
          error: error instanceof Error ? error.message : String(error),
          retryCount,
          willRetry: retryCount < maxRetries,
        });

        if (retryCount < maxRetries) {
          setTimeout(() => setupViewerCountSubscription(retryCount + 1), delay);
        } else {
          debugLog("Max retry attempts reached, stopping reconnection");
        }
      },
      onComplete: () => {
        debugLog("tRPC subscription completed, reconnecting...", { retryCount });
        if (retryCount < maxRetries) {
          setTimeout(() => setupViewerCountSubscription(retryCount + 1), delay);
        } else {
          debugLog("Max retry attempts reached, stopping reconnection");
        }
      },
    });

    // Store subscription for cleanup
    return subscription;
  } catch (error) {
    debugLog("Failed to setup tRPC subscription", {
      error: error instanceof Error ? error.message : String(error),
      retryCount,
      willRetry: retryCount < maxRetries,
    });

    if (retryCount < maxRetries) {
      setTimeout(() => setupViewerCountSubscription(retryCount + 1), delay);
    } else {
      debugLog("Max retry attempts reached, stopping reconnection");
    }
  }
}

// Start worker
if (isValidBrowserRequest()) {
  debugLog("Worker started", { sessionId });

  // Send initial ping
  ping();

  // Setup heartbeat interval
  const pingTimer = setInterval(ping, VIEWER_HEARTBEAT_INTERVAL);

  // Setup tRPC subscription for real-time viewer count updates
  const subscription = setupViewerCountSubscription();

  // Cleanup
  const cleanup = () => {
    clearInterval(pingTimer);
    if (subscription) {
      subscription.unsubscribe();
    }
    remove();
  };

  self.addEventListener("beforeunload", cleanup);
  self.addEventListener("pagehide", cleanup);
}

debugLog("File loaded and executing");
