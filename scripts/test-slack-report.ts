import { reportError } from "../src/lib/error-reporter";

async function testSlackReport() {
  console.log("Testing Slack error reporting...");

  // Test error with context
  const testError = new Error("This is a test error for Slack reporting");
  testError.stack = "Test stack trace\n  at testFunction (/path/to/file.ts:10:5)";

  try {
    await reportError(testError, "Test Context - Manual Script Execution");
    console.log("✅ Slack report sent successfully");
  } catch (error) {
    console.error("❌ Failed to send Slack report:", error);
  }
}

// Run the test
testSlackReport().catch(console.error);
