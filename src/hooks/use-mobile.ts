"use client";

import { useEffect, useState } from "react";

/**
 * モバイルデバイスかどうかを判定するカスタムフック
 * ウィンドウサイズとタッチイベントの有無をチェックします
 *
 * @returns {boolean} モバイルデバイスの場合true、それ以外はfalse
 */
export const useMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };

    // 初回チェック
    checkMobile();

    // リサイズイベントのリスナーを追加
    window.addEventListener("resize", checkMobile);

    // クリーンアップ
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile ?? false;
};
