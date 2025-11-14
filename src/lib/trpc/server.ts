import { appRouter } from "@/server/trpc/routers/_app";
import { createServerContext } from "@/server/trpc/context";

export async function createServerTRPCClient() {
  const context = await createServerContext();

  return appRouter.createCaller(context);
}

// Server Component用ヘルパー
export async function getServerTRPC() {
  return createServerTRPCClient();
}
