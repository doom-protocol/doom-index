import { ArchiveLoader } from "@/components/archive/archive-loader";
import { Header } from "@/components/ui/header";

export default function Loading() {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      <ArchiveLoader />
    </main>
  );
}
