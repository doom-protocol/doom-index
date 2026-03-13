"use client";

import type { FC } from "react";

const GlobalError: FC<{ error: Error & { digest?: string } }> = ({ error }) => {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: "serif",
        }}
      >
        <main
          style={{
            display: "grid",
            gap: "0.75rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "32rem",
              lineHeight: 1.6,
              color: "rgba(255, 255, 255, 0.72)",
            }}
          >
            An unexpected error interrupted the gallery. Please reload the page and try again.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              color: "rgba(255, 255, 255, 0.5)",
            }}
          >
            {error.digest ? `Reference: ${error.digest}` : null}
          </p>
        </main>
      </body>
    </html>
  );
};

export default GlobalError;
