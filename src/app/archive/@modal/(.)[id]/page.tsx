import { ArchiveDetailModal } from "@/components/archive/archive-detail-modal";

interface ModalDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ModalDetailPage({ params }: ModalDetailPageProps) {
  const { id } = await params;
  return <ArchiveDetailModal id={id} />;
}
