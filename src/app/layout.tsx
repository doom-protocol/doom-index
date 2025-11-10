import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { getJsonFromPublicUrl } from "@/lib/r2";
import { logger } from "@/utils/logger";
import { env } from "@/env";
import type { GlobalState } from "@/types/domain";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Generate dynamic metadata with OGP image
 */
export async function generateMetadata(): Promise<Metadata> {
  // Fetch state for enhanced metadata (optional)
  const stateUrl = `${env.R2_PUBLIC_DOMAIN}/state/global.json`;
  const stateResult = await getJsonFromPublicUrl<GlobalState>(stateUrl);

  let description =
    "8 global indicators ($CO2, $ICE, $FOREST, $NUKE, $MACHINE, $PANDEMIC, $FEAR, $HOPE) visualized as generative art in real-time.";

  if (stateResult.isOk() && stateResult.value) {
    const state = stateResult.value;
    if (state.lastTs) {
      const lastUpdate = new Date(state.lastTs).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      description = `Last updated: ${lastUpdate}. ${description}`;
    }
  } else {
    logger.warn("metadata.state-fetch-failed", {
      url: stateUrl,
      error: stateResult.isErr() ? stateResult.error.message : "Unknown error",
    });
  }

  return {
    title: "DOOM INDEX - World State Visualization",
    description,
    openGraph: {
      type: "website",
      siteName: "DOOM INDEX",
      locale: "en_US",
      title: "DOOM INDEX - World State Visualization",
      description,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "DOOM INDEX - Current world state visualization",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@doomindex",
      title: "DOOM INDEX - World State Visualization",
      description,
      images: ["/opengraph-image"],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ margin: 0, padding: 0, width: "100%", height: "100%" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ margin: 0, padding: 0, width: "100%", height: "100%", overflow: "hidden" }}
      >
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
