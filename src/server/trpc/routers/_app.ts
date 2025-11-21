import { router } from "../trpc";
import { mcRouter } from "./mc";
import { viewerRouter } from "./viewer";
import { tokenRouter } from "./token";
import { r2Router } from "./r2";
import { paintingsRouter } from "./paintings";

export const appRouter = router({
  mc: mcRouter,
  viewer: viewerRouter,
  token: tokenRouter,
  r2: r2Router,
  paintings: paintingsRouter,
});

// Export for client-side type inference
export type AppRouter = typeof appRouter;
