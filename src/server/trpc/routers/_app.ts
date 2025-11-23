import { router } from "../trpc";
import { viewerRouter } from "./viewer";
import { tokenRouter } from "./token";
import { r2Router } from "./r2";
import { paintingsRouter } from "./paintings";
import { ipfsRouter } from "./ipfs";

export const appRouter = router({
  viewer: viewerRouter,
  token: tokenRouter,
  r2: r2Router,
  paintings: paintingsRouter,
  ipfs: ipfsRouter,
});

// Export for client-side type inference
export type AppRouter = typeof appRouter;
