import { Providers } from "@/app/providers";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { getBaseUrl } from "@/utils/url";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative } from "next/font/google";
import { ViewTransition } from "react";
import type { ReactNode } from "react";
import "./globals.css";

const cinzelDecorative = Cinzel_Decorative({
  variable: "--font-cinzel-decorative",
  weight: ["400", "700", "900"],
  style: ["normal"],
  display: "swap",
  subsets: ["latin"],
  preload: true,
  fallback: ["serif"],
  adjustFontFallback: true,
});

/**
 * Generate metadata with OGP image
 *
 * Using generateMetadata() to ensure environment variables are available at runtime.
 * Fallback to production URL if NEXT_PUBLIC_BASE_URL is not set.
 */
export function generateMetadata(): Metadata {
  const description =
    "A decentralized archive of financial emotions. AI generates one painting every hour, translating the collective psychology of trending tokens into visual art.";
  const title = "DOOM INDEX";
  // Use environment-based URL
  const metadataBase = new URL(getBaseUrl());
  const ogImageUrl = new URL("/opengraph-image", metadataBase).toString();
  const ogImageAlt = "DOOM INDEX - A decentralized archive of financial emotions.";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "DOOM INDEX",
      locale: "en_US",
      title,
      description,
      url: metadataBase,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: ogImageAlt,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@doomindex",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          alt: ogImageAlt,
          width: 1200,
          height: 630,
        },
      ],
    },
    other: {
      "devfun-verification": "",
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
  children: ReactNode;
}>) {
  return (
    <ViewTransition>
      <html lang="en" style={{ margin: 0, padding: 0, width: "100%", height: "100%", backgroundColor: "#000000" }}>
        <body
          className={`${cinzelDecorative.variable} antialiased`}
          style={{ margin: 0, padding: 0, width: "100%", height: "100%", overflow: "hidden" }}
        >
          <LoadingIndicator />
          <Providers>{children}</Providers>
        </body>
        <GoogleAnalytics gaId="G-RMLTMSSJ8T" />
      </html>
    </ViewTransition>
  );
}
