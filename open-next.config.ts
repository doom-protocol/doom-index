import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Cloudflare R2 Binding を Next.js ランタイムに注入
  // キャッシュ設定はデフォルトを使用
});
