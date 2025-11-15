import MDXArticle from "@/components/about/mdx-article";
import { AboutScene } from "@/components/about/about-scene";
import { Header } from "@/components/ui/header";
import type { Metadata } from "next";
import type { NextPage } from "next";
import { getBaseUrl } from "@/utils/url";

const metadataBase = new URL(getBaseUrl());

export const metadata: Metadata = {
  title: "About - DOOM INDEX",
  description:
    "Learn about the DOOM INDEX project and its mission to visualize global indicators through generative art",
  metadataBase,
};

const AboutPage: NextPage = async () => {
  return (
    <>
      <main style={{ width: "100%", height: "100%", margin: 0, padding: 0, overflow: "hidden" }}>
        <Header showProgress={false} />
        <AboutScene>
          <MDXArticle />
        </AboutScene>
      </main>
      {/* リーダーモード用の通常HTML（視覚的には非表示） */}
      <article className="sr-only" aria-label="About DOOM INDEX">
        <MDXArticle />
      </article>
    </>
  );
};

export default AboutPage;
