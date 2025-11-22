"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook to animate number changes smoothly
 * Uses a simple linear interpolation for smooth transitions
 */
export function useAnimatedNumber(target: number, duration: number = 500): number {
  const [displayValue, setDisplayValue] = useState<number>(target);
  const animationRef = useRef<number | null>(null);
  const currentValueRef = useRef<number>(target);

  // Keep currentValueRef in sync with displayValue
  useEffect(() => {
    currentValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    // If this is the first value, set it immediately
    if (currentValueRef.current === target) {
      return;
    }

    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Start new animation from current display value
    const startValue = currentValueRef.current;
    const difference = target - startValue;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out function for smoother animation
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const currentValue = Math.round(startValue + difference * easeOut);
      setDisplayValue(currentValue);
      currentValueRef.current = currentValue;

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
        currentValueRef.current = target;
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [target, duration]);

  return displayValue;
}
