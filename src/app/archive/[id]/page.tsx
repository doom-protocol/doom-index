import { ArchiveDetailStandaloneLoader } from "@/components/archive/archive-detail-standalone-loader";
import { resolveCloudflareEnv } from "@/lib/cloudflare-context";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import { getBaseUrl } from "@/utils/url";
import { logger } from "@/utils/logger";
import type { Metadata, NextPage } from "next";
import { notFound } from "next/navigation";

interface ArchiveDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ArchiveDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const metadataBase = new URL(getBaseUrl());

  try {
    const env = await resolveCloudflareEnv();
    if (!env) {
      throw new Error("Cloudflare context not available");
    }
    const repo = createPaintingsRepository({ d1Binding: env.DB });
    const result = await repo.findById(id);

    if (result.isOk() && result.value) {
      const painting = result.value;
      const date = new Date(painting.timestamp);
      const title = `Archive #${painting.id.slice(0, 8)} - DOOM INDEX`;

      return {
        title,
        description: `Generated ${date.toLocaleDateString()} - ${painting.prompt.slice(0, 160)}`,
        metadataBase,
        openGraph: {
          title,
          images: [painting.imageUrl],
        },
      };
    }
  } catch (e) {
    logger.warn("ArchiveDetailPage: generateMetadata failed", { id, error: e });
  }

  return {
    title: "Archive - DOOM INDEX",
    description: "Generative art piece from DOOM INDEX",
    metadataBase,
  };
}

async function fetchPainting(id: string) {
  try {
    const env = await resolveCloudflareEnv();
    if (!env) {
      throw new Error("Cloudflare context not available");
    }
    const repo = createPaintingsRepository({ d1Binding: env.DB });
    const result = await repo.findById(id);

    if (result.isErr()) {
      logger.error("ArchiveDetailPage: Failed to fetch painting", {
        id,
        error: result.error,
      });
      return null;
    }

    return result.value;
  } catch (e) {
    logger.error("ArchiveDetailPage: Error fetching painting", { id, error: e });
    return null;
  }
}

const ArchiveDetailPage: NextPage<ArchiveDetailPageProps> = async ({ params }) => {
  const { id } = await params;
  const painting = await fetchPainting(id);

  if (painting === null) {
    notFound();
  }

  return <ArchiveDetailStandaloneLoader item={painting} />;
};

export default ArchiveDetailPage;
