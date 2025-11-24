import { Header } from "@/components/ui/header";
import { ArchiveContent } from "@/components/archive/archive-content";
import type { NextPage } from "next";
import type { Metadata } from "next";
import { getBaseUrl } from "@/utils/url";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listImages } from "@/services/paintings/list";
import { logger } from "@/utils/logger";
import type { Painting } from "@/types/paintings";

const metadataBase = new URL(getBaseUrl());

export const metadata: Metadata = {
  title: "Archive - DOOM INDEX",
  description: "Browse the archive of generative art pieces created by DOOM INDEX",
  metadataBase,
};

interface ArchivePageProps {
  searchParams: Promise<{
    page?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

// Separate component to fetch data to use in Suspense
async function ArchiveData({ page, startDate, endDate }: { page: number; startDate?: string; endDate?: string }) {
  let items: Painting[] = [];
  let hasMore = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const r2 = env.R2_BUCKET;
    const db = env.DB;

    if (r2 && db) {
      const limit = 24;
      const offset = (page - 1) * limit;

      const result = await listImages(r2, db, {
        limit,
        offset,
        startDate,
        endDate,
      });

      if (result.isOk()) {
        items = result.value.items;
        hasMore = result.value.hasMore;
      } else {
        logger.error("ArchivePage: Failed to fetch images", { error: result.error });
      }
    } else {
      logger.warn("ArchivePage: Missing R2 or DB binding");
    }
  } catch (e) {
    logger.error("ArchivePage: Error fetching context or data", { error: e });
  }

  return <ArchiveContent items={items} hasNextPage={hasMore} page={page} />;
}

const ArchivePage: NextPage<ArchivePageProps> = async ({ searchParams }) => {
  const params = await searchParams;
  const startDate = params.startDate;
  const endDate = params.endDate;
  const page = Number(params.page) || 1;

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      <ArchiveData page={page} startDate={startDate} endDate={endDate} />
    </main>
  );
};

export default ArchivePage;
