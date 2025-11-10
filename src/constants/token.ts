export const TOKEN_TICKERS = ["CO2", "ICE", "FOREST", "NUKE", "MACHINE", "PANDEMIC", "FEAR", "HOPE"] as const;

export type TokenTicker = (typeof TOKEN_TICKERS)[number];

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
    address: "Cy1GS2FqefgaMbi45UunrUzin1rfEmTUYnomddzBpump",
    supply: 1_000_000_000,
    axes: ["fogDensity", "skyTint"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "ICE",
    address: "eL5fUxj2J4CiQsmW85k5FG9DvuQjjUoBHoQBi2Kpump",
    supply: 1_000_000_000,
    axes: ["reflectivity", "blueBalance"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "FOREST",
    address: "DKu9kykSfbN5LBfFXtNNDPaX35o4Fv6vJ9FKk7pZpump",
    supply: 1_000_000_000,
    axes: ["vegetationDensity", "organicPattern"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "NUKE",
    address: "8gHPxqgHj6JQ2sQtMSghQYVN5qRP8wm5T6HNejuwpump",
    supply: 1_000_000_000,
    axes: ["radiationGlow", "debrisIntensity"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "MACHINE",
    address: "2u3ufZ5defxwPXMixvvQpSs68PDNzHTdE52t9Crspump",
    supply: 1_000_000_000,
    axes: ["mechanicalPattern", "metallicRatio"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "PANDEMIC",
    address: "CXcWiHFDM1J8RHfAuzor1YGSk6BxGKFY5kstjUZjpump",
    supply: 1_000_000_000,
    axes: ["fractalDensity", "bioluminescence"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "FEAR",
    address: "6W8FHYE6jnw1dktabRRiZpQRQFPSFhTeLczdvBNPzVeo",
    supply: 1_000_000_000,
    axes: ["shadowDepth", "redHighlight"],
    normalization: DEFAULT_NORMALIZATION,
  },
  {
    ticker: "HOPE",
    address: "GnM6XZ7DN9KSPW2ZVMNqCggsxjnxHMGb2t4kiWrUpump",
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
