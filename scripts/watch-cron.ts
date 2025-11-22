#!/usr/bin/env bun

/**
 * Cron Job Watcher for Local Development
 *
 * This script periodically calls the scheduled cron endpoint
 * to simulate Cloudflare Workers cron triggers during local development.
 *
 * Usage:
 *   bun scripts/watch-cron.ts
 *   bun scripts/watch-cron.ts --port 8787
 *   bun scripts/watch-cron.ts --interval 60
 */

type Args = {
  port: number;
  interval: number; // seconds
  cron: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  const parsed: Partial<Args> = {
    port: 8787,
    interval: 120, // 2 minutes
    cron: "*/2 * * * *", // Every 2 minutes
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--port":
      case "-p":
        parsed.port = parseInt(next, 10);
        i++;
        break;
      case "--interval":
      case "-i":
        parsed.interval = parseInt(next, 10);
        i++;
        break;
      case "--cron":
      case "-c":
        parsed.cron = next;
        i++;
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: bun scripts/watch-cron.ts [options]

Options:
  --port, -p <number>     Server port (default: 8787)
  --interval, -i <number> Interval in seconds (default: 120)
  --cron, -c <string>     Cron expression (default: "*/2 * * * *")
  --help, -h              Show this help

Examples:
  bun scripts/watch-cron.ts
  bun scripts/watch-cron.ts --port 8787 --interval 120
  bun scripts/watch-cron.ts --interval 30
        `);
        process.exit(0);
    }
  }

  return parsed as Args;
};

const callCronEndpoint = async (port: number, cron: string): Promise<boolean> => {
  const url = `http://localhost:${port}/__scheduled?cron=${encodeURIComponent(cron)}`;
  const timestamp = new Date().toISOString();

  // カウントダウン行をクリアしてからログを出力
  process.stdout.write("\r" + " ".repeat(80) + "\r");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "watch-cron-script/1.0",
      },
    });

    if (response.ok) {
      console.log(`[${timestamp}] ✅ Cron triggered successfully (${response.status})`);
      return true;
    } else {
      console.log(`[${timestamp}] ⚠️  Cron endpoint returned ${response.status}`);
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`[${timestamp}] ❌ Failed to call cron endpoint: ${errorMessage}`);
    return false;
  }
};

const getMillisecondsUntilNextMinute = (): number => {
  const now = new Date();
  const nextMinute = new Date(now);
  nextMinute.setMinutes(now.getMinutes() + 1);
  nextMinute.setSeconds(0);
  nextMinute.setMilliseconds(0);
  return nextMinute.getTime() - now.getTime();
};

const updateCountdown = (
  targetIntervalMs: number,
  startTime: number,
  label: string = "Next execution",
): (() => void) => {
  let countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  let lastLineLength = 0;

  const update = () => {
    const now = Date.now();
    const elapsed = now - startTime;
    const remaining = Math.max(0, targetIntervalMs - elapsed);
    const remainingSeconds = Math.ceil(remaining / 1000);
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ⏱️  ${label}: ${remainingSeconds}s remaining`;

    // 前の行をクリア（前回の行の長さ分のスペースで上書き）
    process.stdout.write("\r" + " ".repeat(Math.max(lastLineLength, line.length)) + "\r");
    // 新しい行を書き込む
    process.stdout.write(line);
    lastLineLength = line.length;
  };

  // 初期表示
  update();

  // 1秒ごとに更新
  countdownIntervalId = setInterval(update, 1000);

  // クリーンアップ関数を返す
  return () => {
    if (countdownIntervalId) {
      clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
    // カウントダウン行をクリア
    if (lastLineLength > 0) {
      process.stdout.write("\r" + " ".repeat(lastLineLength) + "\r");
      lastLineLength = 0;
    }
  };
};

const main = async () => {
  const args = parseArgs();

  console.log("🚀 Starting cron watcher...");
  console.log(`   Port: ${args.port}`);
  console.log(`   Interval: ${args.interval} seconds`);
  console.log(`   Cron: ${args.cron}`);
  console.log(`   URL: http://localhost:${args.port}/__scheduled?cron=${encodeURIComponent(args.cron)}`);

  // Calculate time until next minute (0 seconds)
  const msUntilNextMinute = getMillisecondsUntilNextMinute();
  const nextMinuteDate = new Date(Date.now() + msUntilNextMinute);
  console.log(`   Next execution: ${nextMinuteDate.toISOString()}`);
  console.log(`   Interval: ${args.interval} seconds`);
  console.log("\nPress Ctrl+C to stop\n");

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let countdownCleanup: (() => void) | null = null;
  const initialStartTime = Date.now();

  const scheduleNextExecution = () => {
    const executionStartTime = Date.now();
    // カウントダウンを開始
    countdownCleanup = updateCountdown(args.interval * 1000, executionStartTime, "Next execution");

    intervalId = setInterval(async () => {
      // 実行前にカウントダウンを停止
      if (countdownCleanup) {
        countdownCleanup();
        countdownCleanup = null;
      }
      await callCronEndpoint(args.port, args.cron);
      // 実行完了後にカウントダウンを再開（実行完了時刻を基準にする）
      const executionCompleteTime = Date.now();
      countdownCleanup = updateCountdown(args.interval * 1000, executionCompleteTime, "Next execution");
    }, args.interval * 1000);
  };

  const cleanup = () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    if (countdownCleanup) {
      countdownCleanup();
      countdownCleanup = null;
    }
  };

  // 初回実行までのカウントダウンを開始
  countdownCleanup = updateCountdown(msUntilNextMinute, initialStartTime, "Initial execution");

  // Wait until next minute (0 seconds), then start periodic execution
  timeoutId = setTimeout(async () => {
    if (countdownCleanup) {
      countdownCleanup();
      countdownCleanup = null;
    }
    await callCronEndpoint(args.port, args.cron);
    scheduleNextExecution();
  }, msUntilNextMinute);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n👋 Stopping cron watcher...");
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n\n👋 Stopping cron watcher...");
    cleanup();
    process.exit(0);
  });
};

main().catch(error => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
