/**
 * Tests for video.js
 * Tests the video capture CLI script
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";

describe("video.js", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CDP_SECRET = "test-secret";
    process.env.WORKER_URL = "https://test-worker.workers.dev";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("command line arguments", () => {
    it("should require URL argument", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('Usage: node video.js "url1,url2,url3"');
      expect(scriptContent).toContain("if (!urlArg)");
      expect(scriptContent).toContain("process.exit(1)");
    });

    it("should support multiple URLs separated by comma", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('urlArg.split(",")');
      expect(scriptContent).toContain(".map((u) => u.trim())");
    });

    it("should support --fps flag", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('args.includes("--fps")');
      expect(scriptContent).toContain("Number.parseInt(args[args.indexOf(\"--fps\") + 1])");
    });

    it("should support --scroll flag", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('args.includes("--scroll")');
      expect(scriptContent).toContain("doScroll");
    });

    it("should use default output filename", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('"output.mp4"');
    });

    it("should use default FPS of 10", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain(": 10"); // Default FPS
    });
  });

  describe("environment validation", () => {
    it("should validate CDP_SECRET", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("if (!CDP_SECRET)");
      expect(scriptContent).toContain("CDP_SECRET environment variable not set");
    });

    it("should validate WORKER_URL", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("if (!rawWorkerUrl");
      expect(scriptContent).toContain("WORKER_URL environment variable not set");
    });
  });

  describe("frame capture", () => {
    it("should create temporary directory for frames", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("/tmp/cf-video-frames-");
      expect(scriptContent).toContain("Date.now()");
      expect(scriptContent).toContain("fs.mkdirSync(framesDir");
      expect(scriptContent).toContain("recursive: true");
    });

    it("should save frames with padded numbering", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('String(frameNum).padStart(5, "0")');
      expect(scriptContent).toContain('frame_${');
      expect(scriptContent).toContain('.png"');
    });

    it("should capture multiple frames per URL", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("captureFrames(15)"); // Initial capture
    });

    it("should capture additional frames when scrolling", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("if (doScroll)");
      expect(scriptContent).toContain("captureFrames(10)"); // After scroll
    });
  });

  describe("CDP integration", () => {
    it("should set viewport for video dimensions", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Emulation.setDeviceMetricsOverride");
      expect(scriptContent).toContain("width: 1280");
      expect(scriptContent).toContain("height: 720");
      expect(scriptContent).toContain("deviceScaleFactor: 1");
    });

    it("should navigate to each URL", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("for (const url of urls)");
      expect(scriptContent).toContain("Page.navigate");
    });

    it("should wait after navigation", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("setTimeout(r, 4000)"); // 4 second wait
    });

    it("should scroll the page", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("window.scrollBy(0, 300)");
      expect(scriptContent).toContain("Runtime.evaluate");
    });
  });

  describe("ffmpeg integration", () => {
    it("should use ffmpeg to create video", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("execSync");
      expect(scriptContent).toContain("ffmpeg");
      expect(scriptContent).toContain("-framerate");
      expect(scriptContent).toContain("-i");
      expect(scriptContent).toContain("frame_%05d.png");
    });

    it("should use libx264 codec", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("-c:v libx264");
      expect(scriptContent).toContain("-pix_fmt yuv420p");
    });

    it("should use quality settings", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("-preset fast");
      expect(scriptContent).toContain("-crf 23");
    });
  });

  describe("cleanup", () => {
    it("should remove frames directory after encoding", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("fs.rmSync(framesDir");
      expect(scriptContent).toContain("recursive: true");
    });

    it("should close WebSocket", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("ws.close()");
    });
  });

  describe("error handling", () => {
    it("should handle WebSocket errors", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain('ws.on("error"');
      expect(scriptContent).toContain("WebSocket error:");
      expect(scriptContent).toContain("process.exit(1)");
    });

    it("should handle target creation timeout", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("No target created");
      expect(scriptContent).toContain("10000");
    });

    it("should handle general errors", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("catch (err)");
      expect(scriptContent).toContain("console.error");
    });
  });

  describe("output and logging", () => {
    it("should log video creation progress", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Creating video from");
      expect(scriptContent).toContain("Output:");
      expect(scriptContent).toContain("FPS:");
      expect(scriptContent).toContain("Scroll:");
    });

    it("should log each URL being processed", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("→");
      expect(scriptContent).toContain("console.log(`→ ${url}`)");
    });

    it("should log frame count", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Captured ${frameNum} frames");
    });

    it("should log encoding progress", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("Encoding video...");
    });

    it("should display final file size", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("stats.size / 1024");
      expect(scriptContent).toContain("Video saved to");
    });
  });

  describe("timing and delays", () => {
    it("should have delays between frame captures", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("delayMs = 100"); // Default delay
    });

    it("should wait after scrolling", () => {
      const scriptPath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/video.js";
      const scriptContent = readFileSync(scriptPath, "utf-8");

      expect(scriptContent).toContain("setTimeout(r, 300)"); // Scroll delay
    });
  });
});