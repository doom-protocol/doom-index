"use client";

import { useEffect, useRef, useState, type FC } from "react";
import useSound from "use-sound";
import { useHaptic } from "use-haptic";

const MINUTE_MS = 60000;
const HAPTIC_WINDOW_START_REMAINING_SECOND = 10;

export const TopBarProgress: FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [displaySecond, setDisplaySecond] = useState<number>(59);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastRemainingRef = useRef<number>(59);
  const previousProgressRef = useRef<number>(0);

  const { triggerHaptic } = useHaptic();
  const [playChime] = useSound("/clock-chime.mp3", { interrupt: true });

  useEffect(() => {
    const animate = () => {
      const now = Date.now();
      const elapsedInCycle = now % MINUTE_MS;
      const remainingMs = MINUTE_MS - elapsedInCycle;
      const nextRemainingSeconds = Math.floor(remainingMs / 1000);
      const currentElapsedProgress = elapsedInCycle / MINUTE_MS;
      const hasWrapped = currentElapsedProgress < previousProgressRef.current;
      const previousRemaining = lastRemainingRef.current;

      if (hasWrapped) {
        if (previousRemaining !== 0) {
          triggerHaptic();
          playChime();
        }
        setDisplaySecond(0);
        setProgress(0);
        lastRemainingRef.current = 0;
        previousProgressRef.current = 0;
      } else {
        const displaySeconds = Math.min(59, nextRemainingSeconds);
        if (displaySeconds !== previousRemaining) {
          if (displaySeconds <= HAPTIC_WINDOW_START_REMAINING_SECOND && displaySeconds > 0) {
            triggerHaptic();
          }
          if (displaySeconds === 0) {
            playChime();
            setProgress(1);
            previousProgressRef.current = 1;
          } else {
            setDisplaySecond(displaySeconds);
            lastRemainingRef.current = displaySeconds;
            // 秒数に基づいてゲージを計算: (60 - displaySeconds) / 60
            const progressValue = (60 - displaySeconds) / 60;
            previousProgressRef.current = currentElapsedProgress;
            setProgress(progressValue);
          }
        } else {
          // 秒数が変わらない場合でも、ゲージを更新
          if (displaySeconds === 0) {
            setProgress(1);
          } else {
            const progressValue = (60 - displaySeconds) / 60;
            // 現在の秒内での進捗を追加
            const msInCurrentSecond = remainingMs % 1000;
            const progressInSecond = msInCurrentSecond / 1000;
            const fineProgress = progressValue + (1 / 60) * (1 - progressInSecond);
            previousProgressRef.current = currentElapsedProgress;
            setProgress(fineProgress);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playChime, triggerHaptic]);

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const secondsLabel = displaySecond.toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-mono text-sm text-white/70 tabular-nums">{secondsLabel} s</span>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/20">
        <div className="h-full bg-white transition-all duration-100" style={{ width: `${clampedProgress * 100}%` }} />
      </div>
    </div>
  );
};
