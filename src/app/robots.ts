import { getBaseUrl } from "@/utils/url";
import type { MetadataRoute } from "next";

/**
 * robots.txt generator
 *
 * Tells search engine crawlers which URLs they can access on the site.
 * Blocks suspicious paths (WordPress, PHP, .env, etc.) to prevent
 * unnecessary crawling and reduce server load from bot/scanner attacks.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  const sitemapUrl = `${baseUrl}/sitemap.xml`;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          // WordPress paths (not used in this app)
          "/wp-admin/",
          "/wp-content/",
          "/wp-includes/",
          "/wp-login.php",
          "/wp-config.php",
          // PHP files (not used in this app)
          "/*.php",
          // Configuration files
          "/.env",
          "/.git/",
          "/.svn/",
          "/.htaccess",
          // Admin/management paths
          "/admin/",
          "/administrator/",
          "/phpinfo",
          "/phpMyAdmin/",
          // Profiler/debug paths
          "/_profiler/",
          // API routes (not needed for SEO)
          "/api/",
          // Well-known paths that might be scanned
          "/.well-known/acme-challenge/",
          // Other common scan targets
          "/xmlrpc.php",
          "/readme.html",
          "/license.txt",
        ],
      },
    ],
    sitemap: sitemapUrl,
    host: baseUrl,
  };
}
