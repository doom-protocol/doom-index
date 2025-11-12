export const TOKEN_TICKERS = ["CO2", "ICE", "FOREST", "NUKE", "MACHINE", "PANDEMIC", "FEAR", "HOPE"] as const;

export type TokenTicker = (typeof TOKEN_TICKERS)[number];

/**
 * Number of decimal places to round market cap values
 * Increased from 4 to 6 to better detect small market cap changes
 * for tokens with large supply (e.g., 1B supply Solana tokens)
 */
export const MARKET_CAP_ROUND_DECIMALS = 10;

/**
 * Number of decimal places to quantize visual parameters
 * Used for hashing visual parameters to create a stable seed
 */
export const QUANTIZE_DECIMALS = 3;

/**
 * Multiplier for rounding market cap values
 * Calculated as 10^MARKET_CAP_ROUND_DECIMALS
 */
export const MARKET_CAP_ROUND_MULTIPLIER = 10 ** MARKET_CAP_ROUND_DECIMALS;

export type VisualParamKey =
  | "fogDensity"
  | "skyTint"
  | "reflectivity"
  | "blueBalance"
  | "vegetationDensity"
  | "organicPattern"
  | "radiationGlow"
  | "debrisIntensity"
  | "mechanicalPattern"
  | "metallicRatio"
  | "fractalDensity"
  | "bioluminescence"
  | "shadowDepth"
  | "redHighlight"
  | "lightIntensity"
  | "warmHue";

export type TokenNormalizationWindow = {
  min: number;
  max: number;
};

export type TokenConfig = {
  ticker: TokenTicker;
  address: string;
  supply: number;
  axes: [VisualParamKey, VisualParamKey];
  normalization: TokenNormalizationWindow;
};

const DEFAULT_NORMALIZATION: TokenNormalizationWindow = { min: 0, max: 2_000_000_000 };

export const TOKENS: TokenConfig[] = [
  {
    ticker: "CO2",
    address: "DffFSfxSBKFp93geSsV1LvNMVyqURKVTiGkhA1DsMgcU", // https://pump.fun/coin/DffFSfxSBKFp93geSsV1LvNMVyqURKVTiGkhA1DsMgcU
    supply: 1_000_000_000,
    axes: ["fogDensity", "skyTint"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "ICE",
    address: "4p1eFvFLxKPYgYrrv69UD4ATZBAceaTBasoxTXW8tiYa", // https://pump.fun/coin/4p1eFvFLxKPYgYrrv69UD4ATZBAceaTBasoxTXW8tiYa
    supply: 1_000_000_000,
    axes: ["reflectivity", "blueBalance"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "FOREST",
    address: "CNAuVvVhi9pRsku7Z4UyMJUnd7ystQmR22e7N1WVtgCu", // https://pump.fun/coin/CNAuVvVhi9pRsku7Z4UyMJUnd7ystQmR22e7N1WVtgCu
    supply: 1_000_000_000,
    axes: ["vegetationDensity", "organicPattern"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "NUKE",
    address: "4VSuakewWBzHQLc3Z4Lpf2sCVLEDx6B1cXhMeWyT8Uap", // https://pump.fun/coin/4VSuakewWBzHQLc3Z4Lpf2sCVLEDx6B1cXhMeWyT8Uap
    supply: 1_000_000_000,
    axes: ["radiationGlow", "debrisIntensity"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "MACHINE",
    address: "FNWaFsgdCu4jFhvsF4cwYFfz2sYcM9U1gvXbBLPvdA5Z", // https://pump.fun/coin/FNWaFsgdCu4jFhvsF4cwYFfz2sYcM9U1gvXbBLPvdA5Z
    supply: 1_000_000_000,
    axes: ["mechanicalPattern", "metallicRatio"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "PANDEMIC",
    address: "2WLeZcqGnSu69oqHxLtpubbHP9RWwagjM7ny4RBF7sbe", // https://pump.fun/coin/2WLeZcqGnSu69oqHxLtpubbHP9RWwagjM7ny4RBF7sbe
    supply: 1_000_000_000,
    axes: ["fractalDensity", "bioluminescence"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "FEAR",
    address: "CmfGCD7MFFL8P5TdeCoPMc9jbu18T88XEesv7ZzR7FGX", // https://pump.fun/coin/CmfGCD7MFFL8P5TdeCoPMc9jbu18T88XEesv7ZzR7FGX
    supply: 1_000_000_000,
    axes: ["shadowDepth", "redHighlight"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "HOPE",
    address: "9CQSWPqP69h1gVnqpQVYsQBByzP9Tyo6dgNqcjyCmW18", // https://pump.fun/coin/9CQSWPqP69h1gVnqpQVYsQBByzP9Tyo6dgNqcjyCmW18
    supply: 1_000_000_000,
    axes: ["lightIntensity", "warmHue"],
    normalization: DEFAULT_NORMALIZATION,
  },
];

export const TOKEN_CONFIG_MAP: Record<TokenTicker, TokenConfig> = TOKENS.reduce(
  (acc, token) => {
    acc[token.ticker] = token;
    return acc;
  },
  {} as Record<TokenTicker, TokenConfig>,
);

export const TOKEN_AXIS_MAP: Record<TokenTicker, TokenConfig["axes"]> = TOKEN_TICKERS.reduce(
  (acc, ticker) => {
    acc[ticker] = TOKEN_CONFIG_MAP[ticker].axes;
    return acc;
  },
  {} as Record<TokenTicker, TokenConfig["axes"]>,
);

export type McMap = Record<TokenTicker, number>;
export type NormalizedMcMap = Record<TokenTicker, number>;
export type McMapRounded = McMap;

export const TOKEN_DESCRIPTIONS: Record<
  TokenTicker,
  {
    title: string;
    description: string;
    motif: string;
  }
> = {
  CO2: {
    title: "CO2 — Pollution and Heat",
    description: "Changes the color of the sky and the density of the haze, veiling the entire city.",
    motif: "Toxic haze thickens across the canvas.",
  },
  ICE: {
    title: "ICE — Ice Sheets and Cooling",
    description: "Increases reflective light and cool tones, turning the world pale blue and frozen.",
    motif: "Glacial gleam fractures the ambient light.",
  },
  FOREST: {
    title: "FOREST — Forests and Life",
    description: "Enhances organic details and green density, reviving vitality.",
    motif: "Verdant growth threads through the ruins.",
  },
  NUKE: {
    title: "NUKE — Destruction and War",
    description: "Scatters flashes and ash particles, heightening apocalyptic tension.",
    motif: "Nuclear ash ignites the horizon.",
  },
  MACHINE: {
    title: "MACHINE — Mechanical Rule",
    description: "Intensifies mechanical lines and structures, depicting artificial dominance.",
    motif: "Mechanical lattice tightens its grip.",
  },
  PANDEMIC: {
    title: "PANDEMIC — Biological Threat",
    description: "Spreads particle-like glowing effects, visualizing the expansion of infection.",
    motif: "Bioluminescent spores continue to bloom.",
  },
  FEAR: {
    title: "FEAR — Darkness and Surveillance",
    description: "Emphasizes shadows and contrast, creating a suffocating sense of tension.",
    motif: "Oppressive shadows watch from every corner.",
  },
  HOPE: {
    title: "HOPE — Light and Regeneration",
    description: "Increases warm colors and brightness, instilling signs of rebirth amid ruin.",
    motif: "Resilient light seeps back into the void.",
  },
};
