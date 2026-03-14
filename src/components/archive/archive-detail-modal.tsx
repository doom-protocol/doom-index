"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { FC } from "react";
import { ArchiveDetailView } from "./archive-detail-view";

interface ArchiveDetailModalProps {
  id: string;
}

export const ArchiveDetailModal: FC<ArchiveDetailModalProps> = ({ id }) => {
  const router = useRouter();
  const trpc = useTRPC();

  const { data: item, isLoading, isError } = useQuery(trpc.paintings.getById.queryOptions({ id }));

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    if (isError) {
      router.back();
    }
  }, [isError, router]);

  if (isLoading || !item) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/95 backdrop-blur-sm"
        style={{ zIndex: 1100 }}
      >
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  return <ArchiveDetailView item={item} onClose={handleClose} />;
};
