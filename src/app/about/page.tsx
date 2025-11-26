import { AboutScene } from "@/components/about/about-scene";
import MDXArticle from "@/components/about/mdx-article";
import { Header } from "@/components/ui/header";
import { getBaseUrl } from "@/utils/url";
import type { Metadata, NextPage } from "next";

const metadataBase = new URL(getBaseUrl());

export const metadata: Metadata = {
  title: "About - DOOM INDEX",
  description:
    "Learn about the DOOM INDEX project and its mission to visualize global indicators through generative art",
  metadataBase,
};

const AboutPage: NextPage = () => {
  return (
    <main style={{ width: "100%", height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
      <Header showProgress={false} />
      <AboutScene>
        <MDXArticle />
      </AboutScene>
      {/* Regular HTML for reader mode (visually hidden) */}
      <article className="sr-only" aria-label="About DOOM INDEX">
        <MDXArticle />
      </article>
    </main>
  );
};

export default AboutPage;
