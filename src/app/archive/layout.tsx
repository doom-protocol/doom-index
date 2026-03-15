import { Header } from "@/components/ui/header";
import type { FC, ReactNode } from "react";

interface ArchiveLayoutProps {
  children: ReactNode;
}

const ArchiveLayout: FC<ArchiveLayoutProps> = ({ children }) => {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      {children}
    </main>
  );
};

export default ArchiveLayout;
