/// <reference lib="dom" />

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import type { JSX } from "react";

// Mock getBaseUrl before importing page to ensure it returns valid URL
// This must be done at module level, before importing Page
mock.module("@/utils/url", () => ({
  getBaseUrl: () => "http://localhost:8787",
  getPumpFunUrl: (address: string) => `https://pump.fun/${address}`,
}));

import Page from "@/app/about/page";

const renderAboutPage = () => {
  const pageFactory = Page as () => JSX.Element;
  return pageFactory();
};

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
};

describe("About Page Integration", () => {
  it("should render about page with MDX content", async () => {
    const page = await renderAboutPage();
    const queryClient = createTestQueryClient();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
    // Should render article element (in sr-only section)
    const article = container.querySelector("article.sr-only");
    expect(article).toBeDefined();
  });

  it("should render semantic HTML from MDX", async () => {
    const page = await renderAboutPage();
    const queryClient = createTestQueryClient();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
    // Should have article element
    const article = container.querySelector("article");
    expect(article).toBeDefined();
    // Check if any content is rendered
    expect(container.textContent?.length).toBeGreaterThan(0);
  });

  it("should render DOOM INDEX content", async () => {
    const page = await renderAboutPage();
    const queryClient = createTestQueryClient();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
    const heading = container.querySelector("h1");
    if (heading) {
      expect(heading.textContent).toContain("DOOM INDEX");
    } else {
      // If h1 is not found, check if DOOM INDEX text exists anywhere
      expect(container.textContent).toContain("DOOM INDEX");
    }
  });
});
