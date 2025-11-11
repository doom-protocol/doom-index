export default {}; // for TypeScript warning

const endpoint = "/api/viewer";

// generate sessionId when Worker starts
const sessionId = crypto.randomUUID();

async function ping(): Promise<void> {
  try {
    const body = JSON.stringify({ sessionId });
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (error) {
    // ignore error (will retry in next heartbeat)
    console.error("viewer.worker.ping.error", error);
  }
}

// send ping immediately when Worker starts
ping();

// send heartbeat every 30 seconds
const timer = setInterval(ping, 30_000);

// clean up timer when Worker ends (usually not needed, but just in case)
self.addEventListener("beforeunload", () => {
  clearInterval(timer);
});
