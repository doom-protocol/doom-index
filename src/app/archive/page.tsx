import { ArchiveContent } from "@/components/archive/archive-content";
import { Header } from "@/components/ui/header";
import { listImages } from "@/server/services/paintings/list";
import type { Painting } from "@/types/paintings";
import { logger } from "@/utils/logger";
import { getBaseUrl } from "@/utils/url";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { Metadata, NextPage } from "next";

const metadataBase = new URL(getBaseUrl());

export const metadata: Metadata = {
  title: "Archive - DOOM INDEX",
  description: "Browse the archive of generative art pieces created by DOOM INDEX",
  metadataBase,
};

interface ArchivePageProps {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
  }>;
}

const ArchivePage: NextPage<ArchivePageProps> = async ({ searchParams }) => {
  const params = await searchParams;
  const from = params.from;
  const to = params.to;
  const page = Number(params.page) || 1;

  let items: Painting[] = [];
  let hasMore = false;

  try {
    const { env } = await getCloudflareContext({ async: true });
    const limit = 24;
    const offset = (page - 1) * limit;

    const result = await listImages(env.DB, {
      limit,
      offset,
      from,
      to,
    });

    if (result.isOk()) {
      items = result.value.items;
      hasMore = result.value.hasMore;
    } else {
      logger.error("ArchivePage: Failed to fetch images", {
        error: result.error,
      });
    }
  } catch (e) {
    logger.error("ArchivePage: Error fetching context or data", { error: e });
  }

  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      <ArchiveContent items={items} hasNextPage={hasMore} page={page} from={from} to={to} />
    </main>
  );
};

export default ArchivePage;
