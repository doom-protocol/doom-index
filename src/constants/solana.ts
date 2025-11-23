/**
 * Solana blockchain constants for NFT minting and related operations
 */

// Metaplex Token Metadata program address
// This is the standard program for creating and managing NFTs on Solana
export const TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

// Associated Token Program address
// Used for creating associated token accounts
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Token Program address
// Core Solana Token program for SPL tokens
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// System Program address
// Solana's built-in system program
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111112";

// Rent sysvar address
// Used for rent calculations
export const RENT_SYSVAR_ID = "SysvarRent111111111111111111111111111111111";

/**
 * Collection NFT address for Doom Index
 * This would be the address of a collection NFT that groups all minted paintings
 * To create a collection NFT:
 * 1. Mint a regular NFT first
 * 2. Use its address here
 * 3. Set verified: true when adding to individual NFTs
 * Set to null if not using collections
 */
export const DOOM_INDEX_COLLECTION_ADDRESS = null;

/**
 * Update authority address
 * The address that has permission to update NFT metadata
 * This could be a multisig wallet or a specific account
 * Set to null to use the minter's address as update authority
 * For production, consider using a multisig wallet here
 */
export const UPDATE_AUTHORITY_ADDRESS = null;

/**
 * Creator addresses and their royalty shares
 * These are the addresses that receive royalty payments when NFTs are sold
 * The total share should add up to 10000 (100%)
 * Addresses should be valid Solana public keys
 */
export const CREATORS = [
  {
    address: "", // TODO: Set the creator/treasury address - should be a valid Solana public key
    verified: false, // Set to true if this creator should be verified (requires signature)
    share: 100, // Royalty share in basis points (100 = 1%, 10000 = 100%)
  },
  // Add additional creators as needed
  // {
  //   address: "AnotherCreatorAddressHere",
  //   verified: false,
  //   share: 50,
  // },
];

/**
 * Default royalty configuration
 */
export const DEFAULT_SELLER_FEE_BASIS_POINTS = 500; // 5% royalty (500 basis points)

/**
 * Network configuration
 */
export const SOLANA_NETWORKS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
} as const;

export type SolanaNetwork = keyof typeof SOLANA_NETWORKS;

/**
 * Get the default Solana network to use
 * Can be overridden by environment variables
 */
export const getDefaultSolanaNetwork = (): SolanaNetwork => {
  try {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK as SolanaNetwork;
    if (network && network in SOLANA_NETWORKS) {
      return network;
    }
  } catch {
    // Ignore environment variable errors
  }
  return "devnet"; // Default fallback
};

/**
 * Get the Solana RPC URL to use
 * Priority: Custom RPC URL > Network-specific URL > Devnet fallback
 */
export const getSolanaRpcUrl = (): string => {
  try {
    const customRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpcUrl && typeof customRpcUrl === "string" && customRpcUrl.trim() !== "") {
      return customRpcUrl.trim();
    }
  } catch {
    // Ignore environment variable errors
  }

  const network = getDefaultSolanaNetwork();
  return SOLANA_NETWORKS[network];
};
