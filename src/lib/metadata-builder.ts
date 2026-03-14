/**
 * NFT Metadata Builder
 *
 * Builds Metaplex-compliant NFT metadata for DOOM INDEX paintings
 * @see https://docs.metaplex.com/programs/token-metadata/token-standard
 */

import { buildDoomNftName } from "@/constants/nft";
import type { VisualParams } from "@/lib/pure/mapping";

/**
 * Parameters for building NFT metadata (legacy, IPFS-based)
 */
export interface BuildMetadataParams {
  cidGlb: string;
  paintingHash: string;
  timestamp: string;
  walletAddress?: string;
}

/**
 * Parameters for building full NFT metadata (Arweave-based)
 */
export interface BuildFullMetadataParams {
  painting: {
    id: string;
    seed: string;
    paramsHash: string;
    fileSize: number;
    visualParams: VisualParams;
    prompt: string;
    negative: string;
  };
  arweaveImageUrl: string;
  arweaveAnimationUrl: string;
  arweaveImageContentType?: string;
  tokenNumber: number;
}

/**
 * Full Metaplex-compliant NFT metadata with rich attributes
 */
export interface FullNftMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  animation_url: string;
  external_url: string;
  category: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  doom_index: {
    source_id: string;
    seed: string;
    params_hash: string;
    visual_parameters: VisualParams;
    prompt: string;
    negative_prompt: string;
  };
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
  };
}

/**
 * Metaplex-compliant NFT metadata
 */
export interface NftMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  properties: {
    files: Array<{
      uri: string;
      type: string;
    }>;
    category: string;
  };
}

/**
 * Build NFT metadata for a DOOM INDEX painting (legacy, IPFS-based)
 */
export function buildNftMetadata(params: BuildMetadataParams): NftMetadata {
  const { cidGlb, paintingHash, timestamp, walletAddress } = params;

  const truncatedHash = paintingHash.slice(0, 19);

  const attributes: NftMetadata["attributes"] = [
    {
      trait_type: "Painting Hash",
      value: paintingHash,
    },
    {
      trait_type: "Created At",
      value: timestamp,
    },
  ];

  if (walletAddress) {
    attributes.push({
      trait_type: "Minted By",
      value: walletAddress,
    });
  }

  return {
    name: buildDoomNftName(truncatedHash),
    symbol: "DOOM",
    description:
      "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions. " +
      "This 3D painting translates the collective psychology of cryptocurrency markets into visual art.",
    image: `ipfs://${cidGlb}`,
    external_url: "https://doomindex.fun",
    attributes,
    properties: {
      files: [
        {
          uri: `ipfs://${cidGlb}`,
          type: "model/gltf-binary",
        },
      ],
      category: "glb",
    },
  };
}

/**
 * Build full NFT metadata for Arweave-based upload
 */
export function buildFullNftMetadata(params: BuildFullMetadataParams): FullNftMetadata {
  const { painting, arweaveImageUrl, arweaveAnimationUrl, arweaveImageContentType = "image/png", tokenNumber } = params;
  const vp = painting.visualParams;

  const attributes: FullNftMetadata["attributes"] = [
    { trait_type: "Generated", value: painting.id },
    { trait_type: "ID", value: tokenNumber },
    { trait_type: "Seed", value: painting.seed },
    { trait_type: "Params Hash", value: painting.paramsHash },
    { trait_type: "File Size", value: painting.fileSize },
    // Visual parameters
    { trait_type: "Fog Density", value: vp.fogDensity },
    { trait_type: "Sky Tint", value: vp.skyTint },
    { trait_type: "Reflectivity", value: vp.reflectivity },
    { trait_type: "Blue Balance", value: vp.blueBalance },
    { trait_type: "Vegetation Density", value: vp.vegetationDensity },
    { trait_type: "Organic Pattern", value: vp.organicPattern },
    { trait_type: "Radiation Glow", value: vp.radiationGlow },
    { trait_type: "Debris Intensity", value: vp.debrisIntensity },
    { trait_type: "Mechanical Pattern", value: vp.mechanicalPattern },
    { trait_type: "Metallic Ratio", value: vp.metallicRatio },
    { trait_type: "Fractal Density", value: vp.fractalDensity },
    { trait_type: "Bioluminescence", value: vp.bioluminescence },
    { trait_type: "Shadow Depth", value: vp.shadowDepth },
    { trait_type: "Red Highlight", value: vp.redHighlight },
    { trait_type: "Light Intensity", value: vp.lightIntensity },
    { trait_type: "Warm Hue", value: vp.warmHue },
    { trait_type: "Prompt", value: painting.prompt },
    { trait_type: "Negative Prompt", value: painting.negative },
  ];

  return {
    name: buildDoomNftName(tokenNumber),
    symbol: "DOOM",
    description:
      "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions. " +
      "This 3D painting translates the collective psychology of cryptocurrency markets into visual art.",
    image: arweaveImageUrl,
    animation_url: arweaveAnimationUrl,
    external_url: `https://doomindex.fun/artworks/${String(tokenNumber)}`,
    category: "vr",
    attributes,
    doom_index: {
      source_id: painting.id,
      seed: painting.seed,
      params_hash: painting.paramsHash,
      visual_parameters: painting.visualParams,
      prompt: painting.prompt,
      negative_prompt: painting.negative,
    },
    properties: {
      files: [
        { uri: arweaveImageUrl, type: arweaveImageContentType },
        { uri: arweaveAnimationUrl, type: "model/gltf-binary" },
      ],
      category: "vr",
    },
  };
}
