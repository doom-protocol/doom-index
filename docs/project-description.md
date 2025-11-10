## DOOM INDEX — 最終企画書（Vercel 版）

> Every buy paints the apocalypse.  
> 世界の終わりは、オンチェーンで静かに描かれる。  
> 君のトランザクションが、筆跡になる。

---

### 1. プロジェクト概要

DOOM INDEX は、Solana 上で発行される複数の指標トークン（`$CO2 / $ICE / $FOREST / $NUKE / $MACHINE / $PANDEMIC / $FEAR / $HOPE`）の Market Cap 変動をリアルタイムに取得し、その全データをプロンプトとして AI に与え、1 分ごとに「終末の世界」を再構築して描画するアートプロジェクト。

- **同期性**: 生成画像は Solana 上の市場データに完全同期
- **筆致**: 各トークンの市場活動（Buy/Sell）＝ AI 絵画の筆跡
- **UI**: 美術館空間 × 金縁の額縁 × 一枚の絵 という極限のミニマリズム

> “市場のノイズを、詩的構造に変換する。”

---

### 2. コンセプト

市場はカオスだ。価格変動は生物的でも、芸術的でもない。だがそれを視覚化し、美学に昇華できるなら、数字は“魂の振動”になる。

DOOM INDEX は、**「買われた瞬間にアートが変わる」**という、経済と現代アート表現を一体化したオンチェーンの社会実験である。

---

### 3. プロダクト体験（UX）

| 要素          | 内容                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| 🖼 画面構成   | 暗い美術館空間（r3f + three.js）。中央に金縁の額縁、内部は AI 生成絵画。 |
| ⏱ 更新       | Vercel の Scheduled Function（1min）による生成 cron。                    |
| ⚙️ 条件       | 前回と MC が全く同一なら skip（無駄生成防止）。                          |
| 📊 Dashboard  | 右上に 8 トークンのリアルタイム Market Cap 表示。                        |
| 💫 Visual Cue | 上部ゲージが 1 分で満ちる。満了とともに新作描画。                        |
| 🐦 Share      | 「Tweet this」ボタンで即シェア。OG 画像は常に最新生成。                  |

---

### 4. トークン設計（世界の指標）

| Token     | 意味       | 絵画への影響軸             | 対応する生成要素                  |
| --------- | ---------- | -------------------------- | --------------------------------- |
| $CO2      | 汚染・熱   | 空の色、霧の濃度、彩度低下 | fogDensity, skyTint               |
| $ICE      | 氷床・冷却 | 光反射率、地表反射、冷色化 | reflectivity, blueBalance         |
| $FOREST   | 森林・生命 | 緑の密度、自然ディテール   | vegetationDensity, organicPattern |
| $NUKE     | 破壊・戦争 | 光の閃光、灰、粒子ノイズ   | radiationGlow, debrisIntensity    |
| $MACHINE  | 機械・支配 | メカニカル線・構造密度     | mechanicalPattern, metallicRatio  |
| $PANDEMIC | 生命的脅威 | 有機パターン・粒子拡散     | fractalDensity, bioluminescence   |
| $FEAR     | 闇・監視   | 影の深さ、暗部コントラスト | shadowDepth, redHighlight         |
| $HOPE     | 光・再生   | 発光強度、暖色比率、透明感 | lightIntensity, warmHue           |

全指標を同時にプロンプトへ埋め込み。絵画は地球全体の状態を統合的に描写。

---

### 5. 技術構成（Vercel フル運用）

| 層            | 技術スタック                                           |
| ------------- | ------------------------------------------------------ |
| Frontend      | Next.js（App Router）+ React Three Fiber + Tailwind v4 |
| Scheduler     | Vercel Scheduled Function（cron @ 1min）               |
| API           | Vercel Edge Function（Dexscreener → AI 生成呼び出し）  |
| AI Repository | 抽象化層：Runware / Replicate / OpenAI 切替可          |
| Data          | Dexscreener API（price, MC, volume）                   |
| State         | React Query（フェッチとキャッシュ制御）                |
| Storage       | Vercel Blob（最新画像キャッシュ）                      |

---

### 6. 生成ロジック

1. 各トークンの MC を取得（Dexscreener）
2. 全トークンの `MC_i` を正規化 → `[0..1]`
3. 連続比較：全トークンが前回と同値 → `skip`
4. 差分があれば、新しい AI プロンプトを構築し、画像生成

```ts
const mc = await fetchMC();
const hashNow = hash(JSON.stringify(mc));
const hashPrev = await blob.get("prevHash");
if (hashNow !== hashPrev) {
  await generateAIImage(mc);
  await blob.put("prevHash", hashNow);
}
```

---

### 7. 画像生成プロンプト（全指標埋込）

```text
Square surreal oil painting in a baroque gold frame, dark museum lighting.
Depict the current state of the world based on on-chain data:
CO2({mc_CO2}), ICE({mc_ICE}), FOREST({mc_FOREST}), NUKE({mc_NUKE}),
MACHINE({mc_MACHINE}), PANDEMIC({mc_PANDEMIC}), FEAR({mc_FEAR}), HOPE({mc_HOPE})
Blend motifs: toxic haze, glacial gleam, living forest, nuclear ash,
mechanical lattice, pandemic bloom, oppressive shadows, resilient light.
Intensity={entropy}, Contrast={contrast}, ColorTemperature={color_temp}.
Hyperreal oil texture, cinematic chiaroscuro, 1:1 webp 1024x1024.
seed={sha256(timestamp + sum(mc_i))}.
```

---

### 8. コストモデル（Vercel + Runware 想定）

| パラメータ        | 値                         |
| ----------------- | -------------------------- |
| 生成単価（c_img） | $0.002／回（Runware 実勢） |
| 分数／日（M）     | 1440                       |
| 生成率（r）       | 0.25（skip 有効時）        |
| 月日数            | 30                         |

月次コスト試算：

```text
MonthlyCost = c_img × M × 30 × r
            = 0.002 × 1440 × 30 × 0.25
            ≈ $21.6 / 月
```

※ 夜間取引停止時間を考慮すれば `r ≈ 0.15` → 実効 `$13` 前後。

---

### 9. 収益モデル（Pump.fun trade fee）

| 項目                            | 値                           |
| ------------------------------- | ---------------------------- |
| trade fee                       | 0.05% (= 0.0005)             |
| 平均取引額                      | $1,000（低流動トークン前提） |
| 1 分あたり総取引回数（T_total） | 0.02〜0.1（8 トークン合算）  |
| トークン数（N）                 | 8                            |
| 日次分数                        | 1440                         |

1 トークンあたりの平均取引回数は `T_token = T_total / N` とする。

シナリオ別損益：

| モード    | 総取引回数（T_total） | 1 トークンあたり月収益 | 月収益合計 | 月コスト |    純利益 |
| --------- | --------------------: | ---------------------: | ---------: | -------: | --------: |
| Minimal   |                  0.02 |                 $54.00 |    $432.00 |   $21.60 |   $410.40 |
| Realistic |                  0.05 |                $135.00 |  $1,080.00 |   $21.60 | $1,058.40 |
| Active    |                  0.10 |                $270.00 |  $2,160.00 |   $21.60 | $2,138.40 |

- 各トークンからの trade fee を合算して収益を算定。
- コストが単一画像生成に限定されるため、スプレッドが大幅に改善。

---

### 10. 拡散・リテンション設計

| 機構             | 内容                               | 意図                      |
| ---------------- | ---------------------------------- | ------------------------- |
| 🔁 OG 連動 Tweet | 「Tweet this」で最新画像＋URL 共有 | シェア 1 回で外部流入発生 |
| 🕰 1 分ゲージ    | 更新サイクルを「儀式化」           | 滞在継続時間 ↑            |
| 🔥 段階演出      | MC 段階変化時に色温・構図大変化    | “もう一段”への購買誘発    |
| 🌑 Doom Hour     | 1 日 1 回、照明変化                | 定時リテンション確保      |
| 💥 Graduation    | 目標 MC 到達で額縁が金色化         | 達成欲＋SNS 拡散          |
| 🧠 Entropy Sync  | 他トークンが上昇時、全体に微変化   | 群行動・相関錯覚の演出    |

---

### 11. 外部生成リソース

| 要素           | サービス                     | プロンプト例                                                                    |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------- |
| 額縁 3D モデル | Meshy.ai                     | “ornate baroque frame, aged gold, GLB, PBR-ready”                               |
| サムネイル     | Midjourney                   | “baroque surreal oil painting representing {TOKEN}, cinematic chiaroscuro, 1:1” |
| 背景壁         | ambientCG / PolyHaven        | plaster wall, dark HDRI lighting                                                |
| 画像生成       | Runware / Replicate / OpenAI | 全指標プロンプト埋込・WebP 出力                                                 |

---

### 12. KPI 設計

| KPI 指標    | 意図                               |
| ----------- | ---------------------------------- |
| Tx/min      | 取引活性度。トレード誘発の効果測定 |
| Tweet/min   | 拡散率。拡散ループ可視化           |
| View Time   | 平均滞在時間。1 分ゲージ視聴維持率 |
| r           | 実生成率。コスト最適性の確認       |
| Return Rate | 再訪率。Doom Hour 効果の計測       |

---

### 13. リスクと対策

| リスク           | 対応                                   |
| ---------------- | -------------------------------------- |
| 無取引・市場静止 | skip 判定で生成停止（r 低減）          |
| API 障害         | 前回値キャッシュ＋ Grace 生成          |
| AI provider 切替 | Repository 層抽象化で対応              |
| 商用素材         | 全テクスチャ CC0 / 自前生成            |
| 規制・金融誤認   | 明確に「アートプロジェクト」として定義 |

---

### 14. 経済的射程

- 損益分岐点：総取引回数 `T_total ≈ 0.001`（= 0.000125/トークン）で黒字化。
- トレード誘発のアート化により、1 枚の絵に複数の購買動機（感情・美学・価格期待）を内包。
- アートとミームの境界を曖昧にすることで、Solana 文化圏における「アート＝投機」の新解釈を提示。

---

### 15. コンセプトステートメント

> 市場の揺らぎを、  
> 世界の呼吸として描く。
>
> アートが値動きに支配され、  
> 値動きがアートを形づくる。
>
> DOOM INDEX は  
> “破滅のインデックス”であり、  
> “生の可視化”である。

---

### 16. 次フェーズ

- ✅ MVP（1 分 Cron + Skip + 画像生成 + Tweet 機構）
- 🔜 Doom Hour / Graduation / r3f 演出最適化
- 🔜 NFT 化（代表作を Edition Mint）
- 🔜 Community Release（Open Index 式プロジェクト化）

---

### 17. 収益見通しまとめ（Vercel 統合版）

| モード    | 日 Tx（総計） | 月 Tx（総計） | Fee 収益 |  Cost |   純利益 |
| --------- | ------------: | ------------: | -------: | ----: | -------: |
| Minimal   |          28.8 |           864 |     $432 | $21.6 |   $410.4 |
| Realistic |          72.0 |         2,160 |   $1,080 | $21.6 | $1,058.4 |
| Active    |         144.0 |         4,320 |   $2,160 | $21.6 | $2,138.4 |

---

### 結論

DOOM INDEX は「トレード」「美」「終末」を同一座標上に並べる。トークンはキャンバス、トランザクションは筆跡、AI は画家。**“人類の末期的経済活動を、美術館の静けさで包む”**という逆説的構造を持つ。

Solana 上で最も静かで、最も美しいミーム。そして、動くたびに世界を描き換えるアートシステム。

> Every buy paints the apocalypse.  
> Every sell erases hope.

---

この状態で「開発要件定義書」に移行すれば、アーキテクチャ、API 仕様、フォルダ構成、関数粒度（pure 関数設計方針）まで精密に詰められます。

次に続けて「開発要件定義書」作成へ進みますか？
