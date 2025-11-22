"use client";

import { useEffect, useRef, useState, type FC } from "react";
import useSound from "use-sound";
import { useHaptic } from "use-haptic";
import { useLatestPainting, useLatestPaintingRefetch } from "@/hooks/use-latest-painting";
import { logger } from "@/utils/logger";
import { GENERATION_INTERVAL_MS } from "@/constants";

const INTERVAL_MS = GENERATION_INTERVAL_MS;
const HAPTIC_WINDOW_START_REMAINING_SECOND = 10;

export const HeaderProgress: FC = () => {
  const [displaySecond, setDisplaySecond] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const { triggerHaptic } = useHaptic();
  const [playChime] = useSound("/clock-chime.mp3", { interrupt: true });
  const refetchLatestPainting = useLatestPaintingRefetch();
  const { dataUpdatedAt } = useLatestPainting();

  const intervalLabel = INTERVAL_MS === 3600000 ? "1h" : INTERVAL_MS === 60000 ? "1m" : "Next Generation";

  useEffect(() => {
    let animationFrameId: number | undefined;
    let intervalStartPerf = performance.now() - (Date.now() % INTERVAL_MS);
    let lastDisplayedSecond = -1;

    const updateProgressWidth = (ratio: number) => {
      if (progressBarRef.current) {
        const clamped = Math.min(1, Math.max(0, ratio));
        progressBarRef.current.style.width = `${clamped * 100}%`;
      }
    };

    const syncInitialState = () => {
      const now = Date.now();
      const elapsedInInterval = now % INTERVAL_MS;
      intervalStartPerf = performance.now() - elapsedInInterval;
      const initialProgress = elapsedInInterval / INTERVAL_MS;
      const initialRemainingSeconds = Math.floor((INTERVAL_MS - elapsedInInterval) / 1000);

      updateProgressWidth(initialProgress);
      lastDisplayedSecond = initialRemainingSeconds;
      setDisplaySecond(initialRemainingSeconds);
    };

    const handleIntervalBoundary = (previousSecond: number) => {
      if (previousSecond !== 0) {
        triggerHaptic();
      }
      playChime();

      // Only refetch if data is stale (older than interval)
      // React Query handles automatic refetches, so manual refetch is only needed
      // if the automatic refetch hasn't occurred yet or failed
      const timeSinceLastUpdate = Date.now() - dataUpdatedAt;
      const isDataFresh = timeSinceLastUpdate < INTERVAL_MS;

      if (!isDataFresh) {
        refetchLatestPainting().catch(error => {
          logger.error("header-progress.refetchLatestPainting.failed", { error });
        });
      } else {
        logger.debug("header-progress.refetch.skipped", {
          timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000),
          reason: "data_fresh",
        });
      }
    };

    const tick = (timestamp: number) => {
      let elapsedMs = timestamp - intervalStartPerf;

      if (elapsedMs < 0) {
        intervalStartPerf = timestamp;
        elapsedMs = 0;
      }

      if (elapsedMs >= INTERVAL_MS) {
        const wraps = Math.floor(elapsedMs / INTERVAL_MS);
        for (let i = 0; i < wraps; i += 1) {
          handleIntervalBoundary(lastDisplayedSecond);
        }
        intervalStartPerf += wraps * INTERVAL_MS;
        elapsedMs = timestamp - intervalStartPerf;
        lastDisplayedSecond = -1;
      }

      updateProgressWidth(elapsedMs / INTERVAL_MS);

      const remainingMs = Math.max(0, INTERVAL_MS - elapsedMs);
      const nextRemainingSeconds = Math.floor(remainingMs / 1000);

      if (nextRemainingSeconds !== lastDisplayedSecond) {
        if (nextRemainingSeconds <= HAPTIC_WINDOW_START_REMAINING_SECOND && nextRemainingSeconds > 0) {
          triggerHaptic();
        }
        setDisplaySecond(nextRemainingSeconds);
        lastDisplayedSecond = nextRemainingSeconds;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    syncInitialState();
    animationFrameId = requestAnimationFrame(tick);

    return () => {
      if (animationFrameId !== undefined) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playChime, refetchLatestPainting, triggerHaptic, dataUpdatedAt]);

  const minutes = Math.floor(displaySecond / 60);
  const seconds = displaySecond % 60;
  const timeLabel = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div className="flex h-[68px] flex-col items-center gap-2">
      <span className="text-white/60 text-sm font-cinzel-decorative tracking-wide">{intervalLabel}</span>
      <span className="font-mono text-sm text-white/70 tabular-nums">{timeLabel}</span>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/20">
        <div ref={progressBarRef} className="h-full bg-white" />
      </div>
    </div>
  );
};
