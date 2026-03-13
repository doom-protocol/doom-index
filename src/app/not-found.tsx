import type { Metadata, NextPage } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 - DOOM INDEX",
};

const NotFound: NextPage = () => {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundColor: "#000000",
        color: "#ffffff",
        fontFamily: "var(--font-cinzel-decorative), serif",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "3rem",
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          404
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: "1.5rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "32rem",
            fontSize: "0.875rem",
            lineHeight: 1.6,
            color: "rgba(255, 255, 255, 0.6)",
          }}
        >
          The page you are looking for does not exist in this gallery.
        </p>
        <Link
          href="/"
          style={{
            marginTop: "0.5rem",
            fontSize: "0.875rem",
            color: "rgba(255, 255, 255, 0.7)",
            textDecoration: "underline",
            textUnderlineOffset: "4px",
          }}
        >
          Return to gallery
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
