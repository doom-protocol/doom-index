/**
 * NFT Metadata Builder
 *
 * Builds Metaplex-compliant NFT metadata for DOOM INDEX paintings
 * @see https://docs.metaplex.com/programs/token-metadata/token-standard
 */

/**
 * Parameters for building NFT metadata
 */
export interface BuildMetadataParams {
  cidGlb: string;
  paintingHash: string;
  timestamp: string;
  walletAddress?: string;
}

/**
 * Metaplex-compliant NFT metadata
 */
export interface NftMetadata {
  name: string; // Max 32 chars
  symbol: string; // Max 10 chars
  description: string;
  image: string; // ipfs://{cidGlb}
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
 * Build NFT metadata for a DOOM INDEX painting
 *
 * @param params - Metadata parameters
 * @returns Metaplex-compliant metadata
 */
export function buildNftMetadata(params: BuildMetadataParams): NftMetadata {
  const { cidGlb, paintingHash, timestamp, walletAddress } = params;

  // Truncate painting hash to fit Metaplex name length limit (32 chars)
  // "DOOM INDEX #" = 13 chars, leaving 19 chars for hash
  const truncatedHash = paintingHash.slice(0, 19);

  // Build attributes
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

  // Add wallet address if provided
  if (walletAddress) {
    attributes.push({
      trait_type: "Minted By",
      value: walletAddress,
    });
  }

  return {
    name: `DOOM INDEX #${truncatedHash}`,
    symbol: "DOOM",
    description:
      "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions. " +
      "This 3D painting translates the collective psychology of cryptocurrency markets into visual art.",
    image: `ipfs://${cidGlb}`,
    external_url: `https://doomindex.fun`,
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
