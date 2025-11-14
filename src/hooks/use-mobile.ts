"use client";

import { useEffect, useState } from "react";

/**
 * Browser detection の汎用フック
 *
 * @param detector - ブラウザ環境を検出する関数（true/false を返す）
 * @param deps - useEffect の依存配列（リスナー登録が必要な場合に使用）
 * @returns {boolean} detector が true を返す場合 true、それ以外は false
 */
function useBrowserDetection(detector: () => boolean, deps: React.DependencyList = []): boolean {
  const [result, setResult] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const check = () => {
      const detected = detector();
      if (detected !== result) {
        setResult(detected);
      }
    };

    check();

    // deps が空でない場合のみリスナー登録（resize など）
    if (deps.length > 0) {
      window.addEventListener("resize", check);
      return () => {
        window.removeEventListener("resize", check);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result ?? false;
}

/**
 * モバイルデバイスかどうかを判定するカスタムフック
 * ウィンドウサイズとタッチイベントの有無をチェックします
 *
 * @returns {boolean} モバイルデバイスの場合true、それ以外はfalse
 */
export const useMobile = (): boolean => {
  return useBrowserDetection(
    () => window.innerWidth < 768 || "ontouchstart" in window,
    [], // resize イベントを監視するため空配列を渡す（deps.length チェックで判定）
  );
};

/**
 * iOSデバイス（WebKit）かどうかを判定するカスタムフック
 *
 * @returns {boolean} iOSデバイスの場合true、それ以外はfalse
 */
export const useIOS = (): boolean => {
  return useBrowserDetection(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  });
};
