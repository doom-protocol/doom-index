import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

function _getLocalDb(): string {
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

export default process.env.NODE_ENV === "production"
  ? defineConfig({
      schema: "./src/db/index.ts",
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
      schema: "./src/db/index.ts",
      dialect: "sqlite",
      out: "./migrations",
    });
