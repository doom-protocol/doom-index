export const DOOM_NFT_NAME = "DOOM NFT";

export function buildDoomNftName(tokenId?: bigint | number | string | null): string {
  if (tokenId === null || tokenId === undefined) {
    return DOOM_NFT_NAME;
  }

  return `${DOOM_NFT_NAME} #${String(tokenId)}`;
}
