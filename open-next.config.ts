import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
// import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import { purgeCache } from "@opennextjs/cloudflare/overrides/cache-purge/index";

const config = defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  // queue: doQueue,
  cachePurge: purgeCache({ type: "direct" }),
});

config.default.minify = true;

export default config;
