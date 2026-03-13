import {
  DOOM_NFT_PROGRAM_ID,
  MPL_CORE_PROGRAM_ID,
  buildMintDoomIndexNftInstruction,
  buildReserveTokenIdInstruction,
  decodeGlobalConfigAccount,
  deriveCollectionUpdateAuthorityPda,
  deriveGlobalConfigPda,
  deriveReservationPda,
} from "@/lib/anchor/doom-nft-program";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "bun:test";

const textEncoder = new TextEncoder();
const TOKEN_ID = BigInt(42);

function encodeU32LE(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function encodeU64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function encodeString(value: string): Uint8Array {
  const stringBytes = textEncoder.encode(value);
  return Uint8Array.from([...encodeU32LE(stringBytes.length), ...stringBytes]);
}

function createPublicKey(fillValue: number): PublicKey {
  return new PublicKey(new Uint8Array(32).fill(fillValue));
}

function buildGlobalConfigAccountData(params: {
  admin: PublicKey;
  baseMetadataUrl: string;
  bump: number;
  collection: PublicKey;
  collectionUpdateAuthority: PublicKey;
  mintPaused: boolean;
  nextTokenId: bigint;
  upgradeAuthority: PublicKey;
}): Uint8Array {
  const discriminator = Uint8Array.from([149, 8, 156, 202, 160, 252, 176, 217]);

  return Uint8Array.from([
    ...discriminator,
    ...params.admin.toBytes(),
    ...params.upgradeAuthority.toBytes(),
    ...encodeU64LE(params.nextTokenId),
    params.mintPaused ? 1 : 0,
    ...encodeString(params.baseMetadataUrl),
    ...params.collection.toBytes(),
    ...params.collectionUpdateAuthority.toBytes(),
    params.bump,
  ]);
}

describe("unit/lib/anchor/doom-nft-program", () => {
  it("decodes GlobalConfig account data", () => {
    const admin = createPublicKey(1);
    const upgradeAuthority = createPublicKey(2);
    const collection = createPublicKey(3);
    const collectionUpdateAuthority = createPublicKey(4);
    const data = buildGlobalConfigAccountData({
      admin,
      baseMetadataUrl: "https://arweave.net/manifest",
      bump: 255,
      collection,
      collectionUpdateAuthority,
      mintPaused: false,
      nextTokenId: TOKEN_ID,
      upgradeAuthority,
    });

    const decoded = decodeGlobalConfigAccount(data);

    expect(decoded.admin.toBase58()).toBe(admin.toBase58());
    expect(decoded.upgradeAuthority.toBase58()).toBe(upgradeAuthority.toBase58());
    expect(decoded.nextTokenId).toBe(TOKEN_ID);
    expect(decoded.mintPaused).toBe(false);
    expect(decoded.baseMetadataUrl).toBe("https://arweave.net/manifest");
    expect(decoded.collection.toBase58()).toBe(collection.toBase58());
    expect(decoded.collectionUpdateAuthority.toBase58()).toBe(collectionUpdateAuthority.toBase58());
    expect(decoded.bump).toBe(255);
  });

  it("derives the expected PDAs for global config, collection authority, and reservation", () => {
    const globalConfig = deriveGlobalConfigPda();
    const expectedGlobalConfig = PublicKey.findProgramAddressSync(
      [textEncoder.encode("global_config")],
      DOOM_NFT_PROGRAM_ID,
    )[0];
    const collectionAuthority = deriveCollectionUpdateAuthorityPda(globalConfig);
    const expectedCollectionAuthority = PublicKey.findProgramAddressSync(
      [textEncoder.encode("collection_authority"), globalConfig.toBytes()],
      DOOM_NFT_PROGRAM_ID,
    )[0];
    const reservation = deriveReservationPda(TOKEN_ID);
    const expectedReservation = PublicKey.findProgramAddressSync(
      [textEncoder.encode("reservation"), encodeU64LE(TOKEN_ID)],
      DOOM_NFT_PROGRAM_ID,
    )[0];

    expect(globalConfig.toBase58()).toBe(expectedGlobalConfig.toBase58());
    expect(collectionAuthority.toBase58()).toBe(expectedCollectionAuthority.toBase58());
    expect(reservation.toBase58()).toBe(expectedReservation.toBase58());
  });

  it("builds the reserve_token_id instruction with the IDL account order", () => {
    const globalConfig = deriveGlobalConfigPda();
    const reservation = deriveReservationPda(TOKEN_ID);
    const user = createPublicKey(9);

    const instruction = buildReserveTokenIdInstruction({
      globalConfig,
      reservation,
      user,
    });

    expect(instruction.programId.toBase58()).toBe(DOOM_NFT_PROGRAM_ID.toBase58());
    expect(Array.from(instruction.data)).toEqual([7, 8, 207, 40, 48, 69, 156, 194]);
    expect(
      instruction.keys.map((key) => ({
        isSigner: key.isSigner,
        isWritable: key.isWritable,
        pubkey: key.pubkey.toBase58(),
      })),
    ).toEqual([
      { isSigner: false, isWritable: true, pubkey: globalConfig.toBase58() },
      { isSigner: false, isWritable: true, pubkey: reservation.toBase58() },
      { isSigner: true, isWritable: true, pubkey: user.toBase58() },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId.toBase58() },
    ]);
  });

  it("builds the mint_doom_index_nft instruction with token_id encoded as u64 little-endian", () => {
    const globalConfig = deriveGlobalConfigPda();
    const reservation = deriveReservationPda(TOKEN_ID);
    const user = createPublicKey(10);
    const asset = createPublicKey(11);
    const collectionUpdateAuthority = deriveCollectionUpdateAuthorityPda(globalConfig);
    const collection = createPublicKey(12);

    const instruction = buildMintDoomIndexNftInstruction({
      asset,
      collection,
      collectionUpdateAuthority,
      globalConfig,
      reservation,
      tokenId: TOKEN_ID,
      user,
    });

    expect(instruction.programId.toBase58()).toBe(DOOM_NFT_PROGRAM_ID.toBase58());
    expect(Array.from(instruction.data)).toEqual([155, 84, 20, 249, 126, 6, 85, 218, 42, 0, 0, 0, 0, 0, 0, 0]);
    expect(
      instruction.keys.map((key) => ({
        isSigner: key.isSigner,
        isWritable: key.isWritable,
        pubkey: key.pubkey.toBase58(),
      })),
    ).toEqual([
      { isSigner: false, isWritable: false, pubkey: globalConfig.toBase58() },
      { isSigner: false, isWritable: true, pubkey: reservation.toBase58() },
      { isSigner: true, isWritable: true, pubkey: user.toBase58() },
      { isSigner: true, isWritable: true, pubkey: asset.toBase58() },
      { isSigner: false, isWritable: false, pubkey: collectionUpdateAuthority.toBase58() },
      { isSigner: false, isWritable: true, pubkey: collection.toBase58() },
      { isSigner: false, isWritable: false, pubkey: MPL_CORE_PROGRAM_ID.toBase58() },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId.toBase58() },
    ]);
  });
});
