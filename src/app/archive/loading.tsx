import { ArchiveLoader } from "@/components/archive/archive-loader";
import { Header } from "@/components/ui/header";
import { type FC } from "react";

const Loading: FC = () => {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      <ArchiveLoader />
    </main>
  );
};

export default Loading;
