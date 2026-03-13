import { router } from "../trpc";
import { paintingsRouter } from "./paintings";
import { viewerRouter } from "./viewer";

export const appRouter = router({
  viewer: viewerRouter,
  paintings: paintingsRouter,
});

// Export for client-side type inference
export type AppRouter = typeof appRouter;
