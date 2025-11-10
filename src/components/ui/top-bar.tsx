"use client";

import { useEffect, useRef, useState } from "react";

const MINUTE_MS = 60000;

export const TopBar: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    startTimeRef.current = performance.now();

    const animate = () => {
      const elapsed = performance.now() - (startTimeRef.current ?? 0);
      const currentProgress = (elapsed % MINUTE_MS) / MINUTE_MS;

      setProgress(currentProgress);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">DOOM INDEX</h1>
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-sm">Next Generation</span>
            <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-100" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
