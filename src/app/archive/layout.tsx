import { Header } from "@/components/ui/header";
import type { FC, ReactNode } from "react";

interface ArchiveLayoutProps {
  children: ReactNode;
  modal: ReactNode;
}

const ArchiveLayout: FC<ArchiveLayoutProps> = ({ children, modal }) => {
  return (
    <main className="relative h-screen w-full overflow-hidden">
      <Header showProgress={false} />
      {children}
      {modal}
    </main>
  );
};

export default ArchiveLayout;
