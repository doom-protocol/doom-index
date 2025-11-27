"use client";

import { reportGlobalError } from "@/lib/actions/report-error";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
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
