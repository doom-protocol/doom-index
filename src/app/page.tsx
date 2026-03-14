import { HomeClientShell } from "@/app/home-client-shell";
import { createStaticServerCaller } from "@/server/trpc/server-caller";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";

export default async function HomePage() {
  let initialPainting: PaintingMetadata | null = null;

  try {
    const caller = await createStaticServerCaller();
    const result = await caller.paintings.list({ limit: 1 });
    initialPainting = (result.items[0] as PaintingMetadata | undefined) ?? null;
  } catch (error) {
    logger.warn("page.prefetch-painting-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return <HomeClientShell initialPainting={initialPainting} />;
}
