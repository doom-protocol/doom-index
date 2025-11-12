import { createMarketCapService } from "../src/services/market-cap";
import { TOKENS } from "../src/constants/token";
import { roundMc4 } from "../src/lib/round";

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex/tokens";

type DexPair = {
  liquidity?: { usd?: number };
  priceUsd?: string;
  marketCap?: number;
  volume?: { h24?: number };
};

type DexResponse = { pairs?: DexPair[] };

async function checkMarketCap() {
  console.log("=== Market Cap Check ===\n");

  const marketCapService = createMarketCapService();

  for (const token of TOKENS) {
    console.log(`\n[${token.ticker}]`);
    console.log(`Address: ${token.address}`);
    console.log(`Supply: ${token.supply.toLocaleString()}`);

    // DexScreener APIの生レスポンスを確認
    try {
      const url = `${DEXSCREENER_BASE}/${token.address}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status} ${response.statusText}`);
        continue;
      }

      const json = (await response.json()) as DexResponse;
      const pairs = json?.pairs ?? [];

      console.log(`Pairs found: ${pairs.length}`);

      if (pairs.length > 0) {
        // 最初のペアの生データを表示
        console.log("\nFirst pair raw data:");
        console.log(JSON.stringify(pairs[0], null, 2));

        // 各ペアの詳細を表示
        console.log("\nAll pairs details:");
        pairs.forEach((pair: DexPair, idx: number) => {
          const liquidity = pair?.liquidity;
          const liquidityUsd = liquidity?.usd;
          const priceUsd = pair?.priceUsd;
          const price = priceUsd ? Number(priceUsd) : null;
          console.log(`  Pair ${idx + 1}:`);
          console.log(`    priceUsd: ${priceUsd} (type: ${typeof priceUsd})`);
          console.log(`    priceUsd parsed: ${price} (isFinite: ${price !== null && Number.isFinite(price)})`);
          console.log(`    liquidity: ${JSON.stringify(liquidity)}`);
          console.log(
            `    liquidity.usd: ${liquidityUsd} (type: ${typeof liquidityUsd}, isNumber: ${typeof liquidityUsd === "number"})`,
          );
        });

        // 有効なペアをフィルタリング
        const sortedPairs = pairs
          .filter((p: DexPair) => {
            const hasLiquidity = typeof p?.liquidity?.usd === "number";
            const hasPrice = p?.priceUsd && Number.isFinite(Number(p.priceUsd));
            return hasLiquidity && hasPrice;
          })
          .sort((a: DexPair, b: DexPair) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
          .slice(0, 5);

        console.log(`\nValid pairs (with liquidity and price): ${sortedPairs.length}`);
        sortedPairs.forEach((pair: DexPair, idx: number) => {
          const price = Number(pair.priceUsd);
          const liquidity = pair.liquidity?.usd || 0;
          const mc = price * token.supply;
          console.log(
            `  ${idx + 1}. Price: $${price.toFixed(8)}, Liquidity: $${liquidity.toLocaleString()}, MC: $${mc.toLocaleString()}`,
          );
        });

        // marketCapまたはpriceUsdからmarket capを取得
        let bestMc: number | null = null;
        let bestVolume = -1;

        for (const pair of pairs) {
          // marketCapフィールドが直接提供されている場合はそれを使用
          if (typeof pair.marketCap === "number" && Number.isFinite(pair.marketCap) && pair.marketCap > 0) {
            const volume = pair.volume?.h24 || 0;
            if (volume > bestVolume) {
              bestVolume = volume;
              bestMc = pair.marketCap;
            }
            continue;
          }

          // marketCapがない場合はpriceUsdから計算
          const price = pair.priceUsd ? Number(pair.priceUsd) : null;
          if (!price || !Number.isFinite(price)) continue;

          const calculatedMc = price * token.supply;
          if (!Number.isFinite(calculatedMc) || calculatedMc <= 0) continue;

          const volume = pair.volume?.h24 || pair.liquidity?.usd || 0;
          if (volume > bestVolume || bestMc === null) {
            bestVolume = volume;
            bestMc = calculatedMc;
          }
        }

        if (bestMc !== null) {
          const roundedMc = roundMc4({ [token.ticker]: bestMc })[token.ticker];
          console.log(`\n✅ Selected Market Cap: $${bestMc.toLocaleString()}`);
          console.log(`   Rounded MC: $${roundedMc.toLocaleString()}`);
        } else {
          console.log(`❌ No valid market cap found`);
        }
      } else {
        console.log(`❌ No pairs found`);
      }
    } catch (error) {
      console.log(`❌ Exception: ${error instanceof Error ? error.message : "unknown"}`);
    }

    // サービス経由で取得した結果も確認
    const result = await marketCapService.getMcMap();
    if (result.isOk()) {
      const mc = result.value[token.ticker];
      const rounded = roundMc4(result.value)[token.ticker];
      console.log(`\nService Result:`);
      console.log(`   Raw MC: $${mc.toLocaleString()}`);
      console.log(`   Rounded MC: $${rounded.toLocaleString()}`);
    }
  }

  // 全体の結果を表示
  console.log("\n\n=== Summary ===");
  const result = await marketCapService.getMcMap();
  if (result.isOk()) {
    const rounded = roundMc4(result.value);
    for (const [ticker, mc] of Object.entries(rounded)) {
      console.log(`${ticker}: $${mc.toLocaleString()}`);
    }
  }
}

checkMarketCap().catch(console.error);
