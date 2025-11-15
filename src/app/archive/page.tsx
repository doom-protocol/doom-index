import { Header } from "@/components/ui/header";
import { ArchiveContent } from "@/components/archive/archive-content";
import type { NextPage } from "next";
import type { Metadata } from "next";
import { getBaseUrl } from "@/utils/url";

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

const ArchivePage: NextPage<ArchivePageProps> = async ({ searchParams }) => {
  const params = await searchParams;
  const { startDate, endDate } = params;

  return (
    <>
      <main className="relative h-screen w-full overflow-hidden">
        <Header showProgress={false} />
        <ArchiveContent startDate={startDate} endDate={endDate} />
      </main>
    </>
  );
};

export default ArchivePage;
