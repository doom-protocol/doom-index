import { defineConfig } from "drizzle-kit";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function getLocalDb(): string {
  const root = resolve(".wrangler");
  if (!existsSync(root)) throw new Error(".wrangler directory not found");

  const d1Path = resolve(root, "state/v3/d1/miniflare-D1DatabaseObject");
  if (existsSync(d1Path)) {
    const entries = readdirSync(d1Path, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".sqlite")) {
        return resolve(d1Path, entry.name);
      }
    }
  }

  throw new Error("No D1 .sqlite found under .wrangler/state/v3/d1/miniflare-D1DatabaseObject");
}

// Use NEXT_PUBLIC_BASE_URL to detect environment instead of NODE_ENV
// because NODE_ENV can be unreliable in Cloudflare Workers
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
const isProduction = !baseUrl.includes("localhost");

export default isProduction
  ? defineConfig({
      schema: "./src/db/schema/index.ts",
      out: "./migrations",
      dialect: "sqlite",
      driver: "d1-http",
      dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
        token: process.env.CLOUDFLARE_D1_TOKEN!,
      },
    })
  : defineConfig({
      schema: "./src/db/schema/index.ts",
      dialect: "sqlite",
      out: "./migrations",
      dbCredentials: {
        url: getLocalDb(),
      },
    });
