import { router } from "../trpc";
import { mcRouter } from "./mc";
import { viewerRouter } from "./viewer";
import { tokenRouter } from "./token";
import { r2Router } from "./r2";

export const appRouter = router({
  mc: mcRouter,
  viewer: viewerRouter,
  token: tokenRouter,
  r2: r2Router,
});

// クライアント型推論用にエクスポート
export type AppRouter = typeof appRouter;
