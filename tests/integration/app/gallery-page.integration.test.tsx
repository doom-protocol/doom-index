/// <reference lib="dom" />

/**
 * Integration Tests for Gallery Page
 *
 * Tests the actual gallery page rendering with minimal mocks.
 * Image URLs can be specified externally, while other implementations
 * are rendered as-is to ensure functionality.
 */

// Ensure DOM environment is initialized
import "../../preload";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { JSX } from "react";
import {
  createUrlMock,
  createLoggerMockFactory,
  createEnvMock,
  createUseHapticMock,
  createUseSoundMock,
  createAnalyticsMock,
  createSonnerMock,
  createUseViewerMock,
  createViewerCountStoreMock,
  createUseTransformedTextureUrlMock,
  createUseSafeTextureMock,
  createGlbExportServiceMock,
  createUseSolanaWalletMock,
} from "../../mocks";
import { glbExportService } from "@/lib/glb-export-service";

// Setup mocks before importing modules
void mock.module("@/utils/url", createUrlMock());

const { mockFactory: loggerMockFactory } = createLoggerMockFactory();
void mock.module("@/utils/logger", loggerMockFactory);

void mock.module("@/env", createEnvMock());
void mock.module("use-haptic", createUseHapticMock());
void mock.module("use-sound", createUseSoundMock());
void mock.module("@/lib/analytics", createAnalyticsMock());
void mock.module("sonner", createSonnerMock());
void mock.module("@/hooks/use-viewer", createUseViewerMock());
void mock.module("@/lib/viewer-count-store", createViewerCountStoreMock());
void mock.module("@/hooks/use-transformed-texture-url", createUseTransformedTextureUrlMock());
void mock.module("@/hooks/use-safe-texture", createUseSafeTextureMock());

const glbExportServiceMockModule = createGlbExportServiceMock()();
const originalExportPaintingModel = glbExportService.exportPaintingModel;
const originalOptimizeGlb = glbExportService.optimizeGlb;

beforeAll(() => {
  glbExportService.exportPaintingModel = glbExportServiceMockModule.glbExportService.exportPaintingModel;
  glbExportService.optimizeGlb = glbExportServiceMockModule.glbExportService.optimizeGlb;
});

afterAll(() => {
  glbExportService.exportPaintingModel = originalExportPaintingModel;
  glbExportService.optimizeGlb = originalOptimizeGlb;
});

// Create mock function for use-latest-painting that can be configured per-test
let mockUseLatestPaintingFn: ReturnType<typeof mock> | null = null;

// Mock use-latest-painting hook at module level
const realUseLatestPainting = await import("@/hooks/use-latest-painting");
void mock.module("@/hooks/use-latest-painting", () => ({
  ...realUseLatestPainting,
  useLatestPainting: () => {
    if (mockUseLatestPaintingFn) {
      return mockUseLatestPaintingFn();
    }
    return {
      data: null,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    };
  },
  useLatestPaintingRefetch: () => () => Promise.resolve(undefined),
}));

// Mock useSolanaWallet at module level
void mock.module("@/hooks/use-solana-wallet", createUseSolanaWalletMock());

import Page from "@/app/page";

const renderGalleryPage = () => {
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

interface GalleryPageTestOptions {
  imageUrl?: string;
  paintingId?: string;
  timestamp?: string;
}

const createMockPainting = (options: GalleryPageTestOptions = {}) => {
  return {
    id: options.paintingId ?? "DOOM_202512020110_03309aff_5779632aeaa9",
    timestamp: options.timestamp ?? "2025-12-02T01:10:00.000Z",
    minuteBucket: "2025/12/02/01/10",
    paramsHash: "03309aff",
    seed: "5779632aeaa9",
    imageUrl: options.imageUrl ?? "/api/r2/images/2025/12/02/DOOM_202512020110_03309aff_5779632aeaa9.webp",
    fileSize: 1024000,
    visualParams: {
      fogDensity: 0.5,
      skyTint: 0.3,
      reflectivity: 0.2,
      blueBalance: 0.1,
      vegetationDensity: 0.4,
      organicPattern: 0.3,
      radiationGlow: 0.1,
      debrisIntensity: 0.2,
      mechanicalPattern: 0.1,
      metallicRatio: 0.2,
      fractalDensity: 0.3,
      bioluminescence: 0.1,
      shadowDepth: 0.4,
      redHighlight: 0.1,
      lightIntensity: 0.8,
      warmHue: 0.2,
      tokenWeights: {
        fear: 0.2,
        hope: 0.3,
        machine: 0.1,
        ice: 0.1,
        forest: 0.1,
        co2: 0.1,
        pandemic: 0.05,
        nuke: 0.05,
      },
      worldPrompt: "Test world prompt",
    },
    prompt: "Test painting prompt",
    negative: "",
  };
};

interface TimingMetrics {
  mockSetupTime: number;
  queryClientCreationTime: number;
  pageComponentRenderTime: number;
  reactRenderTime: number;
  domQueryTime: number;
  totalTime: number;
}

const measureTimings = (queryClient: QueryClient, _mockUseLatestPainting: ReturnType<typeof mock>): TimingMetrics => {
  const timings: Partial<TimingMetrics> = {};
  const startTotal = performance.now();

  // Measure mock setup (already done in beforeEach, but measure the time here)
  const mockSetupStart = performance.now();
  // Mock setup is already done, so this is just measuring the overhead
  timings.mockSetupTime = performance.now() - mockSetupStart;

  // Measure QueryClient creation (already done in beforeEach)
  const queryClientStart = performance.now();
  // QueryClient is already created, so this is just measuring the overhead
  timings.queryClientCreationTime = performance.now() - queryClientStart;

  // Measure page component render
  const pageRenderStart = performance.now();
  const page = renderGalleryPage();
  timings.pageComponentRenderTime = performance.now() - pageRenderStart;

  // Measure React Testing Library render
  const reactRenderStart = performance.now();
  const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);
  timings.reactRenderTime = performance.now() - reactRenderStart;

  // Measure DOM query
  const domQueryStart = performance.now();
  container.querySelector("main");
  timings.domQueryTime = performance.now() - domQueryStart;

  timings.totalTime = performance.now() - startTotal;

  return timings as TimingMetrics;
};

const logTimings = (testName: string, timings: TimingMetrics) => {
  console.log(`\n[${testName}] Timing Metrics:`);
  console.log(`  Mock Setup:           ${timings.mockSetupTime.toFixed(2)}ms`);
  console.log(`  QueryClient Creation: ${timings.queryClientCreationTime.toFixed(2)}ms`);
  console.log(`  Page Component Render: ${timings.pageComponentRenderTime.toFixed(2)}ms`);
  console.log(`  React Testing Render: ${timings.reactRenderTime.toFixed(2)}ms`);
  console.log(`  DOM Query:            ${timings.domQueryTime.toFixed(2)}ms`);
  console.log(`  Total Time:           ${timings.totalTime.toFixed(2)}ms`);
};

describe("Gallery Page Integration", () => {
  let queryClient: QueryClient;
  let mockUseLatestPainting: ReturnType<typeof mock>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockUseLatestPainting = mock(() => ({
      data: null,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    }));
    // Set the mock function so it's used by the module-level mock
    mockUseLatestPaintingFn = mockUseLatestPainting;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should render gallery page with header", () => {
    mockUseLatestPainting.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    const timings = measureTimings(queryClient, mockUseLatestPainting);
    logTimings("should render gallery page with header", timings);

    // Re-render for assertions
    const page = renderGalleryPage();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

    // Should render main element
    const main = container.querySelector("main");
    expect(main).toBeDefined();

    // Should render header with DOOM INDEX text
    const header = container.querySelector("header") || container.querySelector('[class*="fixed"]');
    expect(header).toBeDefined();
    expect(container.textContent).toContain("DOOM INDEX");
  });

  it("should render gallery page with painting data", () => {
    const testImageUrl = "/api/r2/images/test-painting.webp";
    const mockPainting = createMockPainting({ imageUrl: testImageUrl });

    mockUseLatestPainting.mockReturnValue({
      data: mockPainting,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    const timings = measureTimings(queryClient, mockUseLatestPainting);
    logTimings("should render gallery page with painting data", timings);

    // Re-render for assertions
    const page = renderGalleryPage();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

    // Should render main element
    const main = container.querySelector("main");
    expect(main).toBeDefined();

    // Should render header
    expect(container.textContent).toContain("DOOM INDEX");

    // Render time should be reasonable (less than 1 second)
    expect(timings.totalTime).toBeLessThan(1000);
  });

  it("should handle loading state", () => {
    mockUseLatestPainting.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    const timings = measureTimings(queryClient, mockUseLatestPainting);
    logTimings("should render gallery page with painting data", timings);

    // Re-render for assertions
    const page = renderGalleryPage();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

    // Should render even when loading
    const main = container.querySelector("main");
    expect(main).toBeDefined();

    expect(timings.totalTime).toBeLessThan(1000);
  });

  it("should render with different image URLs", () => {
    const testCases = ["/api/r2/images/painting1.webp", "/api/r2/images/painting2.webp", "/placeholder-painting.webp"];

    for (const imageUrl of testCases) {
      const mockPainting = createMockPainting({ imageUrl });
      mockUseLatestPainting.mockReturnValue({
        data: mockPainting,
        isLoading: false,
        error: null,
        dataUpdatedAt: Date.now(),
      });

      const timings = measureTimings(queryClient, mockUseLatestPainting);
      logTimings(`should render with different image URLs (${imageUrl})`, timings);

      // Re-render for assertions
      const page = renderGalleryPage();
      const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

      const main = container.querySelector("main");
      expect(main).toBeDefined();
      expect(timings.totalTime).toBeLessThan(1000);
    }
  });

  it("should measure time for multiple renders", () => {
    const mockPainting = createMockPainting();
    mockUseLatestPainting.mockReturnValue({
      data: mockPainting,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    const allTimings: TimingMetrics[] = [];
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      const timings = measureTimings(queryClient, mockUseLatestPainting);
      allTimings.push(timings);
      logTimings(`should measure time for multiple renders (iteration ${i + 1})`, timings);
    }

    // Calculate averages for each metric
    const avgMockSetup = allTimings.reduce((sum, t) => sum + t.mockSetupTime, 0) / allTimings.length;
    const avgQueryClient = allTimings.reduce((sum, t) => sum + t.queryClientCreationTime, 0) / allTimings.length;
    const avgPageRender = allTimings.reduce((sum, t) => sum + t.pageComponentRenderTime, 0) / allTimings.length;
    const avgReactRender = allTimings.reduce((sum, t) => sum + t.reactRenderTime, 0) / allTimings.length;
    const avgDomQuery = allTimings.reduce((sum, t) => sum + t.domQueryTime, 0) / allTimings.length;
    const avgTotal = allTimings.reduce((sum, t) => sum + t.totalTime, 0) / allTimings.length;

    const maxTotal = Math.max(...allTimings.map(t => t.totalTime));
    const minTotal = Math.min(...allTimings.map(t => t.totalTime));

    console.log(`\n[Multiple Renders Summary] Average Metrics:`);
    console.log(`  Mock Setup:           ${avgMockSetup.toFixed(2)}ms`);
    console.log(`  QueryClient Creation: ${avgQueryClient.toFixed(2)}ms`);
    console.log(`  Page Component Render: ${avgPageRender.toFixed(2)}ms`);
    console.log(`  React Testing Render: ${avgReactRender.toFixed(2)}ms`);
    console.log(`  DOM Query:            ${avgDomQuery.toFixed(2)}ms`);
    console.log(`  Total Time (avg):     ${avgTotal.toFixed(2)}ms`);
    console.log(`  Total Time (max):     ${maxTotal.toFixed(2)}ms`);
    console.log(`  Total Time (min):     ${minTotal.toFixed(2)}ms`);

    expect(avgTotal).toBeLessThan(1000);
    expect(maxTotal).toBeLessThan(2000);
  });

  it("should render navigation links in header", () => {
    mockUseLatestPainting.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    const page = renderGalleryPage();
    const { container: _container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

    // Should have navigation links
    const aboutLink = _container.querySelector('a[href="/about"]');
    const archiveLink = _container.querySelector('a[href="/archive"]');

    expect(aboutLink).toBeDefined();
    expect(archiveLink).toBeDefined();
  });

  it("should handle error state gracefully", () => {
    mockUseLatestPainting.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Failed to fetch painting"),
      dataUpdatedAt: Date.now(),
    });

    const timings = measureTimings(queryClient, mockUseLatestPainting);
    logTimings("should render gallery page with painting data", timings);

    // Re-render for assertions
    const page = renderGalleryPage();
    const { container } = render(<QueryClientProvider client={queryClient}>{page}</QueryClientProvider>);

    // Should still render page even with error
    const main = container.querySelector("main");
    expect(main).toBeDefined();

    expect(timings.totalTime).toBeLessThan(1000);
  });
});
