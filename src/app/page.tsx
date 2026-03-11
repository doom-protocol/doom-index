import { Header } from "@/components/ui/header";
import { createServerCaller } from "@/server/trpc/server-caller";
import type { PaintingMetadata } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  let initialPainting: PaintingMetadata | null = null;

  try {
    const caller = await createServerCaller();
    const result = await caller.paintings.list({ limit: 1 });
    initialPainting = (result.items[0] as PaintingMetadata | undefined) ?? null;
  } catch (error) {
    logger.warn("page.prefetch-painting-failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <main
      style={{
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <Header />
      <HomeClient initialPainting={initialPainting} />
    </main>
  );
}
