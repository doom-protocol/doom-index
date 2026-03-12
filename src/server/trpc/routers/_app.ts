import { router } from "../trpc";
import { paintingsRouter } from "./paintings";
import { r2Router } from "./r2";
import { tokenRouter } from "./token";
import { viewerRouter } from "./viewer";

export const appRouter = router({
  viewer: viewerRouter,
  token: tokenRouter,
  r2: r2Router,
  paintings: paintingsRouter,
});

// Export for client-side type inference
export type AppRouter = typeof appRouter;
