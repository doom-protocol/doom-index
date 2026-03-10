/**
 * Tests for cdp-client.js
 * Tests the CDP WebSocket client library for Cloudflare Browser Rendering
 */

import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";
import EventEmitter from "node:events";

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.sentMessages = [];

    // Simulate connection after a brief delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit("open");
    }, 10);
  }

  send(data) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close");
  }

  // Helper to simulate receiving a message
  simulateMessage(data) {
    this.emit("message", Buffer.from(JSON.stringify(data)));
  }

  // Helper to simulate error
  simulateError(error) {
    this.emit("error", error);
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

describe("cdp-client", () => {
  let originalWebSocket;
  let originalEnv;
  let createClient;

  beforeEach(async () => {
    // Save original WebSocket and environment
    originalWebSocket = global.WebSocket;
    originalEnv = { ...process.env };

    // Set up test environment
    process.env.CDP_SECRET = "test-secret";
    process.env.WORKER_URL = "https://test-worker.workers.dev";

    // Mock WebSocket globally
    global.WebSocket = MockWebSocket;

    // Dynamically import the module to get fresh instance
    const modulePath = "/home/jailuser/git/.agents/skills/cloudflare-browser/scripts/cdp-client.js";
    delete require.cache[require.resolve(modulePath)];
    const module = await import(modulePath);
    createClient = module.createClient;
  });

  afterEach(() => {
    // Restore originals
    global.WebSocket = originalWebSocket;
    process.env = originalEnv;
  });

  describe("createClient", () => {
    it("should throw error when CDP_SECRET is not set", async () => {
      delete process.env.CDP_SECRET;

      await expect(createClient()).rejects.toThrow("CDP_SECRET environment variable not set");
    });

    it("should throw error when WORKER_URL is not set", async () => {
      delete process.env.WORKER_URL;

      await expect(createClient()).rejects.toThrow("WORKER_URL (or options.workerUrl) must be set");
    });

    it("should accept options for secret and workerUrl", async () => {
      delete process.env.CDP_SECRET;
      delete process.env.WORKER_URL;

      const clientPromise = createClient({
        secret: "custom-secret",
        workerUrl: "https://custom-worker.workers.dev"
      });

      // Simulate target creation
      setTimeout(() => {
        const ws = MockWebSocket.prototype;
        const instance = new MockWebSocket("test");
        instance.simulateMessage({
          method: "Target.targetCreated",
          params: {
            targetInfo: {
              type: "page",
              targetId: "test-target-123"
            }
          }
        });
      }, 50);

      const client = await clientPromise;
      expect(client).toBeDefined();
      expect(client.targetId).toBe("test-target-123");
    });

    it("should create client and wait for target", async () => {
      const clientPromise = createClient();

      // Wait for WebSocket to open and then simulate target creation
      await new Promise(resolve => setTimeout(resolve, 20));

      // Get the WebSocket instance that was created
      const wsInstances = MockWebSocket.prototype;
      const mockWs = new MockWebSocket("test");

      mockWs.simulateMessage({
        method: "Target.targetCreated",
        params: {
          targetInfo: {
            type: "page",
            targetId: "target-123"
          }
        }
      });

      const client = await clientPromise;

      expect(client).toBeDefined();
      expect(client.targetId).toBe("target-123");
      expect(client.send).toBeFunction();
      expect(client.navigate).toBeFunction();
      expect(client.screenshot).toBeFunction();
    });

    it("should timeout if target is not created", async () => {
      const clientPromise = createClient({ timeout: 100 });

      await expect(clientPromise).rejects.toThrow("No target created");
    });

    it("should handle WebSocket errors", async () => {
      const clientPromise = createClient();

      await new Promise(resolve => setTimeout(resolve, 20));

      const mockWs = new MockWebSocket("test");
      mockWs.simulateError(new Error("Connection failed"));

      await expect(clientPromise).rejects.toThrow("Connection failed");
    });
  });

  describe("client methods", () => {
    let client;
    let mockWs;

    beforeEach(async () => {
      const clientPromise = createClient();

      await new Promise(resolve => setTimeout(resolve, 20));

      mockWs = new MockWebSocket("test");
      mockWs.simulateMessage({
        method: "Target.targetCreated",
        params: {
          targetInfo: {
            type: "page",
            targetId: "target-123"
          }
        }
      });

      client = await clientPromise;
    });

    describe("send", () => {
      it("should send CDP command and return result", async () => {
        const sendPromise = client.send("Page.navigate", { url: "https://example.com" });

        // Simulate response
        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { frameId: "frame-123" }
          });
        }, 10);

        const result = await sendPromise;
        expect(result).toEqual({ frameId: "frame-123" });
      });

      it("should handle CDP command errors", async () => {
        const sendPromise = client.send("Page.navigate", { url: "invalid" });

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            error: { message: "Navigation failed" }
          });
        }, 10);

        await expect(sendPromise).rejects.toThrow("Navigation failed");
      });

      it("should timeout if no response", async () => {
        const sendPromise = client.send("Page.navigate", { url: "https://example.com" });

        await expect(sendPromise).rejects.toThrow("Timeout");
      });
    });

    describe("navigate", () => {
      it("should navigate to URL and wait", async () => {
        const navigatePromise = client.navigate("https://example.com", 100);

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await navigatePromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.method).toBe("Page.navigate");
        expect(sentMessage.params.url).toBe("https://example.com");
      });
    });

    describe("screenshot", () => {
      it("should capture screenshot as PNG by default", async () => {
        const screenshotPromise = client.screenshot();

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { data: Buffer.from("fake-image").toString("base64") }
          });
        }, 10);

        const buffer = await screenshotPromise;
        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.toString()).toBe("fake-image");
      });

      it("should support JPEG format", async () => {
        const screenshotPromise = client.screenshot("jpeg");

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { data: Buffer.from("fake-jpeg").toString("base64") }
          });
        }, 10);

        await screenshotPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.format).toBe("jpeg");
      });
    });

    describe("setViewport", () => {
      it("should set viewport with default values", async () => {
        const setViewportPromise = client.setViewport();

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await setViewportPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.method).toBe("Emulation.setDeviceMetricsOverride");
        expect(sentMessage.params.width).toBe(1280);
        expect(sentMessage.params.height).toBe(800);
      });

      it("should set custom viewport dimensions", async () => {
        const setViewportPromise = client.setViewport(1920, 1080, 2, true);

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await setViewportPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.width).toBe(1920);
        expect(sentMessage.params.height).toBe(1080);
        expect(sentMessage.params.deviceScaleFactor).toBe(2);
        expect(sentMessage.params.mobile).toBe(true);
      });
    });

    describe("evaluate", () => {
      it("should execute JavaScript expression", async () => {
        const evalPromise = client.evaluate("document.title");

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { result: { value: "Test Page" } }
          });
        }, 10);

        const result = await evalPromise;
        expect(result.result.value).toBe("Test Page");
      });
    });

    describe("scroll", () => {
      it("should scroll by default amount", async () => {
        const scrollPromise = client.scroll();

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await scrollPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.expression).toContain("scrollBy(0, 300)");
      });

      it("should scroll by custom amount", async () => {
        const scrollPromise = client.scroll(500);

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await scrollPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.expression).toContain("scrollBy(0, 500)");
      });
    });

    describe("click", () => {
      it("should click element by selector", async () => {
        const clickPromise = client.click("#button");

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await clickPromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.expression).toContain('querySelector("#button")');
        expect(sentMessage.params.expression).toContain(".click()");
      });
    });

    describe("type", () => {
      it("should type text into element", async () => {
        const typePromise = client.type("#input", "test value");

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: {}
          });
        }, 10);

        await typePromise;

        const sentMessage = JSON.parse(mockWs.sentMessages[0]);
        expect(sentMessage.params.expression).toContain('querySelector("#input")');
        expect(sentMessage.params.expression).toContain('"test value"');
      });
    });

    describe("getHTML", () => {
      it("should get page HTML", async () => {
        const htmlPromise = client.getHTML();

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { result: { value: "<html></html>" } }
          });
        }, 10);

        const html = await htmlPromise;
        expect(html).toBe("<html></html>");
      });
    });

    describe("getText", () => {
      it("should get page text", async () => {
        const textPromise = client.getText();

        setTimeout(() => {
          mockWs.simulateMessage({
            id: 1,
            result: { result: { value: "Page content" } }
          });
        }, 10);

        const text = await textPromise;
        expect(text).toBe("Page content");
      });
    });

    describe("close", () => {
      it("should close WebSocket connection", () => {
        expect(() => client.close()).not.toThrow();
        expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle non-page targets", async () => {
      const clientPromise = createClient({ timeout: 200 });

      await new Promise(resolve => setTimeout(resolve, 20));

      const mockWs = new MockWebSocket("test");

      // Send non-page target (should be ignored)
      mockWs.simulateMessage({
        method: "Target.targetCreated",
        params: {
          targetInfo: {
            type: "background_page",
            targetId: "bg-123"
          }
        }
      });

      await expect(clientPromise).rejects.toThrow("No target created");
    });

    it("should handle malformed messages", async () => {
      const clientPromise = createClient();

      await new Promise(resolve => setTimeout(resolve, 20));

      const mockWs = new MockWebSocket("test");

      // Send valid target first
      mockWs.simulateMessage({
        method: "Target.targetCreated",
        params: {
          targetInfo: {
            type: "page",
            targetId: "target-123"
          }
        }
      });

      const client = await clientPromise;

      // Send malformed response
      mockWs.emit("message", Buffer.from("not json"));

      // Client should still work for next command
      const sendPromise = client.send("Page.navigate", { url: "https://example.com" });

      setTimeout(() => {
        mockWs.simulateMessage({
          id: 1,
          result: {}
        });
      }, 10);

      await expect(sendPromise).resolves.toBeDefined();
    });
  });
});