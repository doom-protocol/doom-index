import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/utils/url";

/**
 * sitemap.xml generator
 *
 * Generates a sitemap for search engine crawlers to efficiently index the site.
 * Includes all public pages with appropriate priority and change frequency.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/archive`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];
}
