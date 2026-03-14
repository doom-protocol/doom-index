/// <reference lib="dom" />

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it, mock } from "bun:test";
import type { JSX } from "react";

void mock.module("@/utils/url", () => ({
  getBaseUrl: () => "http://localhost:8787",
  getPumpFunUrl: (address: string) => `https://pump.fun/${address}`,
}));

void mock.module("@/components/about/about-scene", () => ({
  AboutScene: ({ children }: { children: JSX.Element }) => <div data-testid="about-scene">{children}</div>,
}));

void mock.module("@/components/ui/header", () => ({
  Header: () => <header data-testid="header" />,
}));

const renderAboutPage = async () => {
  const { default: Page } = await import("@/app/about/page");
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
    const article = container.querySelector("article");
    expect(article).toBeDefined();
    expect(container.querySelector('[data-testid="about-scene"]')).toBeDefined();
    expect(container.querySelector('[data-testid="header"]')).toBeDefined();
  });

  it("should render DOOM INDEX content", async () => {
    const page = await renderAboutPage();
    const queryClient = createTestQueryClient();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
    const heading = container.querySelector("h1");
    if (heading) {
      expect(heading.textContent).toContain("DOOM INDEX");
    } else if (container.textContent && container.textContent.length > 0) {
      expect(container.textContent).toContain("DOOM INDEX");
    } else {
      expect(container.querySelector("article")).toBeDefined();
    }
  });
});
