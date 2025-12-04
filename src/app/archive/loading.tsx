import { ArchiveLoader } from "@/components/archive/archive-loader";
import { Header } from "@/components/ui/header";
import { type NextPage } from "next";

const Loading: NextPage = () => {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      <ArchiveLoader />
    </main>
  );
};

export default Loading;
