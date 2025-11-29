"use client";

import { reportGlobalError } from "@/lib/actions/report-error";
import NextError from "next/error";
import { useEffect } from "react";

const CHUNK_RELOAD_KEY = "doom-index:chunk-reload";

function isChunkLoadError(error: Error): boolean {
  return error.name === "ChunkLoadError" || error.message.includes("Loading chunk");
}

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    const isChunkError = isChunkLoadError(error);

    // Report error to Slack via Server Action
    const report = async () => {
      try {
        await reportGlobalError({
          message: error.message,
          stack: error.stack,
          name: error.name,
          digest: error.digest,
        });
      } catch (e) {
        console.error("Failed to report global error:", e);
      }
    };

    void report();

    // Handle ChunkLoadError with auto-reload (once)
    if (isChunkError) {
      const hasReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY);

      if (!hasReloaded) {
        // Set flag to prevent infinite reload loop
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
        // Give time for error report to be sent, then reload
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    }
  }, [error]);

  return (
    <html>
      <body>
        {/* `NextError` is the default Next.js error page component. Its type
        definition requires a `statusCode` prop. However, since the App Router
        does not expose status codes for errors, we simply pass 0 to render a
        generic error message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
