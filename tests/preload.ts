import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "bun:test";

// Ensure NEXT_PUBLIC_R2_URL is unset for tests to avoid route handler disabling
// This overrides any value that might be present in the environment (e.g. from .dev.vars or CI env)
process.env.NEXT_PUBLIC_R2_URL = "";

// Register happy-dom globals
GlobalRegistrator.register();

// Extend expect with @testing-library/jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});
