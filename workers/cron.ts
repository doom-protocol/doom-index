/**
 * Cloudflare Workers Cron Handler
 *
 * 毎分実行される Cron Triggers のエントリポイント。
 * GenerationService.runMinuteGeneration() を呼び出し、
 * 画像生成とstate更新を行う。
 */

import { createServicesForWorkers } from "../src/services/container";

export interface Env {
  R2_BUCKET: R2Bucket;
  PROVIDER_API_KEY: string;
}

// R2 公開ドメインは環境に応じて設定
const R2_PUBLIC_DOMAIN = "https://doom-index-storage.r2.dev";

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const startTime = Date.now();

    console.info("Cron triggered", {
      scheduledTime: new Date(event.scheduledTime).toISOString(),
      cron: event.cron,
    });

    try {
      // サービスコンテナを作成
      const services = createServicesForWorkers(env.R2_BUCKET, R2_PUBLIC_DOMAIN, env.PROVIDER_API_KEY);

      // 画像生成を実行
      const result = await services.generationService.evaluateMinute();

      if (result.isErr()) {
        console.error("Generation failed", {
          error: result.error,
          durationMs: Date.now() - startTime,
        });
        return;
      }

      const { status, hash, imageUrl } = result.value;

      console.info("Cron success", {
        status,
        hash,
        imageUrl,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      console.error("Cron failed", {
        error: message,
        stack,
        durationMs: Date.now() - startTime,
      });
    }
  },
};
