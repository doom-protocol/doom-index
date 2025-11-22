import Article from "@/assets/whitepaper/v2.mdx";

const MDXArticle = () => {
  return (
    <article className="max-w-full m-0 py-12 px-10 bg-transparent text-[#1a1a1a] font-serif text-base leading-[1.7] md:py-8 md:px-6 md:text-xs md:leading-[1.6]">
      <Article />
    </article>
  );
};

export default MDXArticle;
