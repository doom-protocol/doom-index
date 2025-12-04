import Article from "@/assets/whitepaper/v2.mdx";

const MDXArticle: React.FC = () => {
  return (
    <article className="m-0 max-w-full bg-transparent px-10 py-12 font-serif text-base leading-[1.7] text-[#1a1a1a] md:px-6 md:py-8 md:text-xs md:leading-[1.6]">
      <Article />
    </article>
  );
};

export default MDXArticle;
