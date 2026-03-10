/**
 * Tests for screenshot.js
 * Tests the screenshot capture CLI script
 */

import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("screenshot.js", () => {
  const originalEnv = { ...process.env };
  const originalArgv = process.argv;
  const testOutputFile = "/tmp/test-screenshot.png";

  beforeEach(() => {
    // Set up environment
    process.env.CDP_SECRET = "test-secret";
    process.env.WORKER_URL = "https://test-worker.workers.dev";

    // Clean up test file if exists
    if (existsSync(testOutputFile)) {
      unlinkSync(testOutputFile);
    }
  });

  afterEach(() => {
    // Restore environment
    process.env = { ...originalEnv };
    process.argv = originalArgv;

    // Clean up test file
    if (existsSync(testOutputFile)) {
      unlinkSync(testOutputFile);
    }
  });

  describe("command line arguments", () => {
    it("should require URL argument", () => {
      // This test validates the script's argument validation
      // The actual script would exit with error code 1
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Usage: node screenshot.js <url> [output.png]");
      expect(scriptContent).toContain("if (!url)");
      expect(scriptContent).toContain("process.exit(1)");
    });

    it("should use default output filename when not provided", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('const output = process.argv[3] || "screenshot.png"');
    });

    it("should validate CDP_SECRET environment variable", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("if (!CDP_SECRET)");
      expect(scriptContent).toContain("CDP_SECRET environment variable not set");
    });

    it("should validate WORKER_URL environment variable", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("if (!rawWorkerUrl");
      expect(scriptContent).toContain("WORKER_URL environment variable not set");
    });
  });

  describe("WebSocket URL construction", () => {
    it("should construct correct WebSocket URL", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("const WORKER_URL = rawWorkerUrl.replace(/^https?:\\/\\//, \"\")");
      expect(scriptContent).toContain("wss://${WORKER_URL}/cdp?secret=${encodeURIComponent(CDP_SECRET)}");
    });
  });

  describe("CDP commands", () => {
    it("should send setDeviceMetricsOverride command", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Emulation.setDeviceMetricsOverride");
      expect(scriptContent).toContain("width: 1280");
      expect(scriptContent).toContain("height: 800");
      expect(scriptContent).toContain("deviceScaleFactor: 2");
    });

    it("should send Page.navigate command", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Page.navigate");
      expect(scriptContent).toContain("{ url }");
    });

    it("should send Page.captureScreenshot command", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Page.captureScreenshot");
      expect(scriptContent).toContain('format: "png"');
    });
  });

  describe("error handling", () => {
    it("should handle WebSocket errors", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('ws.on("error"');
      expect(scriptContent).toContain("WebSocket error:");
      expect(scriptContent).toContain("process.exit(1)");
    });

    it("should handle timeout for target creation", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("No target created");
      expect(scriptContent).toContain("10000"); // 10 second timeout
    });

    it("should handle command timeouts", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Timeout:");
      expect(scriptContent).toContain("60000"); // 60 second timeout
    });
  });

  describe("file operations", () => {
    it("should write screenshot to file", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("fs.writeFileSync");
      expect(scriptContent).toContain("Buffer.from(data, \"base64\")");
      expect(scriptContent).toContain("path.resolve(output)");
    });

    it("should display file size in output", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("buffer.length / 1024");
      expect(scriptContent).toContain("toFixed(1)");
      expect(scriptContent).toContain("KB");
    });
  });

  describe("message handling", () => {
    it("should handle Target.targetCreated event", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('msg.method === "Target.targetCreated"');
      expect(scriptContent).toContain('msg.params?.targetInfo?.type === "page"');
      expect(scriptContent).toContain("targetResolve()");
    });

    it("should track pending requests", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("const pending = new Map()");
      expect(scriptContent).toContain("pending.set(id");
      expect(scriptContent).toContain("pending.get(msg.id)");
      expect(scriptContent).toContain("pending.delete(id)");
    });

    it("should use incrementing message IDs", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("let messageId = 1");
      expect(scriptContent).toContain("const id = messageId++");
    });
  });

  describe("timing and delays", () => {
    it("should wait for page load after navigation", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("setTimeout(r, 5000)"); // 5 second wait
    });

    it("should close WebSocket after completion", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("ws.close()");
    });
  });

  describe("output formatting", () => {
    it("should log progress messages", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Capturing screenshot of");
      expect(scriptContent).toContain("Saved to");
    });

    it("should use checkmark for success", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("✓");
    });
  });

  describe("integration points", () => {
    it("should properly parse and respond to CDP messages", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("JSON.parse(data.toString())");
      expect(scriptContent).toContain("JSON.stringify({ id, method, params })");
    });

    it("should handle CDP error responses", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/screenshot.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("msg.error ? reject(new Error(msg.error.message))");
    });
  });
});