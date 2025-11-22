"use client";

import { useEffect, useRef, useState, type FC } from "react";
import useSound from "use-sound";
import { useHaptic } from "use-haptic";
import { useLatestPaintingRefetch } from "@/hooks/use-latest-painting";
import { logger } from "@/utils/logger";

const MINUTE_MS = 60000;
const HAPTIC_WINDOW_START_REMAINING_SECOND = 10;

export const HeaderProgress: FC = () => {
  const [displaySecond, setDisplaySecond] = useState<number>(0);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const { triggerHaptic } = useHaptic();
  const [playChime] = useSound("/clock-chime.mp3", { interrupt: true });
  const refetchLatestPainting = useLatestPaintingRefetch();

  useEffect(() => {
    let animationFrameId: number | undefined;
    let minuteStartPerf = performance.now() - (Date.now() % MINUTE_MS);
    let lastDisplayedSecond = -1;

    const updateProgressWidth = (ratio: number) => {
      if (progressBarRef.current) {
        const clamped = Math.min(1, Math.max(0, ratio));
        progressBarRef.current.style.width = `${clamped * 100}%`;
      }
    };

    const syncInitialState = () => {
      const now = Date.now();
      const elapsedInMinute = now % MINUTE_MS;
      minuteStartPerf = performance.now() - elapsedInMinute;
      const initialProgress = elapsedInMinute / MINUTE_MS;
      const initialRemainingSeconds = Math.min(59, Math.floor((MINUTE_MS - elapsedInMinute) / 1000));

      updateProgressWidth(initialProgress);
      lastDisplayedSecond = initialRemainingSeconds;
      setDisplaySecond(initialRemainingSeconds);
    };

    const handleMinuteBoundary = (previousSecond: number) => {
      if (previousSecond !== 0) {
        triggerHaptic();
      }
      playChime();
      refetchLatestPainting().catch(error => {
        logger.error("header-progress.refetchLatestPainting.failed", { error });
      });
    };

    const tick = (timestamp: number) => {
      let elapsedMs = timestamp - minuteStartPerf;

      if (elapsedMs < 0) {
        minuteStartPerf = timestamp;
        elapsedMs = 0;
      }

      if (elapsedMs >= MINUTE_MS) {
        const wraps = Math.floor(elapsedMs / MINUTE_MS);
        for (let i = 0; i < wraps; i += 1) {
          handleMinuteBoundary(lastDisplayedSecond);
        }
        minuteStartPerf += wraps * MINUTE_MS;
        elapsedMs = timestamp - minuteStartPerf;
        lastDisplayedSecond = -1;
      }

      updateProgressWidth(elapsedMs / MINUTE_MS);

      const remainingMs = Math.max(0, MINUTE_MS - elapsedMs);
      const nextRemainingSeconds = Math.min(59, Math.floor(remainingMs / 1000));

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
  }, [playChime, refetchLatestPainting, triggerHaptic]);

  const secondsLabel = displaySecond.toString().padStart(2, "0");

  return (
    <div className="flex h-[68px] flex-col items-center gap-2">
      <span className="text-white/60 text-sm font-cinzel-decorative tracking-wide">Next Generation</span>
      <span className="font-mono text-sm text-white/70 tabular-nums">{secondsLabel} s</span>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/20">
        <div ref={progressBarRef} className="h-full bg-white" />
      </div>
    </div>
  );
};
