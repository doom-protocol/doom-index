import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import type { ReactNode } from "react";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="mt-8 mb-6 text-center text-4xl font-bold">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="mt-12 mb-4 border-b-2 border-[#333] pb-2 text-2xl font-bold">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => <h3 className="mt-8 mb-3 text-xl font-semibold">{children}</h3>,
    h4: ({ children }: { children?: ReactNode }) => (
      <h4 className="mt-6 mb-2 text-lg font-semibold italic">{children}</h4>
    ),
    p: ({ children }: { children?: ReactNode }) => {
      // Helper function to check if children contain block-level elements (img, figure, div, etc.)
      const hasBlockElement = (node: ReactNode): boolean => {
        if (node === null || node === undefined || typeof node === "string" || typeof node === "number") {
          return false;
        }
        if (Array.isArray(node)) {
          return node.some(hasBlockElement);
        }
        if (typeof node === "object" && "type" in node) {
          const type = node.type;
          if (typeof type === "string") {
            return ["figure", "div", "img"].includes(type);
          }
          if (typeof type === "function") {
            return type.name === "img" || type.name === "Image";
          }
        }
        return false;
      };

      // If paragraph contains block-level elements, render as div instead to avoid nesting issues
      if (hasBlockElement(children)) {
        return <div className="mb-4 text-justify leading-7 hyphens-auto">{children}</div>;
      }

      return <p className="mb-4 text-justify leading-7 hyphens-auto">{children}</p>;
    },
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="mb-4 ml-6 list-outside list-disc space-y-1">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="mb-4 ml-6 list-outside list-decimal space-y-1">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li className="leading-7">{children}</li>,
    code: ({ children }: { children?: ReactNode }) => (
      <code className="rounded p-0 font-mono text-[0.6rem]">{children}</code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="mb-6 overflow-x-auto p-1 text-xs break-words whitespace-pre-wrap">{children}</pre>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="border-l-4 border-[#666] bg-[#f5f5f5] pl-3 italic">{children}</blockquote>
    ),
    a: ({ children, href }: { children?: ReactNode; href?: string }) => (
      <a
        href={href}
        className="text-[#0066cc] underline decoration-1 underline-offset-2"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className="overflow-x-auto">
        <table className="w-fit border-collapse border border-gray-300 bg-white text-xs md:text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
    tr: ({ children }: { children?: ReactNode }) => <tr className="border-b border-gray-200">{children}</tr>,
    th: ({ children }: { children?: ReactNode }) => (
      <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold text-gray-900 md:px-4 md:py-3 md:text-sm">
        {children}
      </th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="border border-gray-300 px-2 py-2 text-xs text-gray-700 md:px-4 md:py-3 md:text-sm">{children}</td>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <figure className="my-6 flex flex-col items-center">
        <Image
          src={src || ""}
          alt={alt || ""}
          width={320}
          height={240}
          className="h-auto max-w-xs border border-[#ddd]"
        />
        {alt && <figcaption className="mt-2 text-center text-sm text-[#666] italic">{alt}</figcaption>}
      </figure>
    ),
    hr: () => <hr className="my-8 border-t border-[#ccc]" />,
    ...components,
  };
}
