import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/server/trpc/routers/_app";
import { getBaseUrl } from "@/utils/url";

// tRPC Context ProviderとHooksを作成
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

// tRPCクライアント作成関数
export function createTRPCClientInstance() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,

        // カスタムヘッダー
        async headers() {
          return {
            // 必要に応じて認証ヘッダーなどを追加
          };
        },

        // バッチ設定
        maxURLLength: 2083,
      }),
    ],
  });
}
