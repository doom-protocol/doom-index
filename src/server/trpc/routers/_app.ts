import { router } from "../trpc";
import { mcRouter } from "./mc";
import { viewerRouter } from "./viewer";
import { tokenRouter } from "./token";
import { r2Router } from "./r2";
import { archiveRouter } from "./archive";

export const appRouter = router({
  mc: mcRouter,
  viewer: viewerRouter,
  token: tokenRouter,
  r2: r2Router,
  archive: archiveRouter,
});

// クライアント型推論用にエクスポート
export type AppRouter = typeof appRouter;
