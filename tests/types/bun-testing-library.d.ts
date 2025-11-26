import type matchers from "@testing-library/jest-dom/matchers";

declare module "bun:test" {
  // Extend Bun's Matchers with Testing Library matchers for type safety in tests
  interface Matchers<T = unknown, R = T> extends matchers.TestingLibraryMatchers<T, R> {}
}
