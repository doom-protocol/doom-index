/* eslint-disable @next/next/no-img-element */

import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }: { children?: ReactNode }) => (
      <h1 className="text-4xl font-bold mb-6 mt-8 text-center">{children}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2 className="text-2xl font-bold mt-12 mb-4 pb-2 border-b-2 border-[#333]">{children}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => <h3 className="text-xl font-semibold mt-8 mb-3">{children}</h3>,
    h4: ({ children }: { children?: ReactNode }) => (
      <h4 className="text-lg font-semibold mt-6 mb-2 italic">{children}</h4>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p className="mb-4 leading-7 text-justify hyphens-auto">{children}</p>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className="list-disc list-outside mb-4 space-y-1 ml-6">{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className="list-decimal list-outside mb-4 space-y-1 ml-6">{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li className="leading-7">{children}</li>,
    code: ({ children }: { children?: ReactNode }) => (
      <code className="p-0 rounded text-[0.6rem] font-mono">{children}</code>
    ),
    pre: ({ children }: { children?: ReactNode }) => (
      <pre className="mb-6 text-xs whitespace-pre-wrap break-words p-1 overflow-x-auto">{children}</pre>
    ),
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className="pl-3 italic border-l-4 border-[#666] bg-[#f5f5f5]">{children}</blockquote>
    ),
    a: ({ children, href }: { children?: ReactNode; href?: string }) => (
      <a
        href={href}
        className="underline decoration-1 underline-offset-2 text-[#0066cc]"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className="overflow-x-auto">
        <table
          className="w-fit border-collapse border border-gray-300 bg-white text-xs md:text-sm"
          style={{ tableLayout: "auto" }}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: ReactNode }) => <thead className="bg-gray-50">{children}</thead>,
    tbody: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
    tr: ({ children }: { children?: ReactNode }) => <tr className="border-b border-gray-200">{children}</tr>,
    th: ({ children }: { children?: ReactNode }) => (
      <th className="border border-gray-300 px-2 py-2 md:px-4 md:py-3 text-left font-semibold text-gray-900 text-xs md:text-sm">
        {children}
      </th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="border border-gray-300 px-2 py-2 md:px-4 md:py-3 text-gray-700 text-xs md:text-sm">{children}</td>
    ),
    img: ({ src, alt }: { src?: string; alt?: string }) => (
      <div className="my-6 flex flex-col items-center">
        <img src={src} alt={alt} className="max-w-xs h-auto border border-[#ddd]" />
        {alt && <p className="text-sm mt-2 italic text-center text-[#666]">{alt}</p>}
      </div>
    ),
    hr: () => <hr className="my-8 border-t border-[#ccc]" />,
    ...components,
  };
}
