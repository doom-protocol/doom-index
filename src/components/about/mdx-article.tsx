import Article from "@/assets/whitepaper/v1.mdx";
import styles from "./whitepaper-viewer.module.css";

const MDXArticle = () => {
  return (
    <article className={styles.whitepaperArticle}>
      <Article />
    </article>
  );
};

export default MDXArticle;
