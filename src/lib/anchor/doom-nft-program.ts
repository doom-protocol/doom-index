import doomNftProgramIdl from "@/constants/idl/doom_nft_program.json";
import type { Buffer } from "node:buffer";
import type { Connection } from "@solana/web3.js";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const textEncoder = new TextEncoder();
const GLOBAL_CONFIG_SEED = textEncoder.encode("global_config");
const COLLECTION_AUTHORITY_SEED = textEncoder.encode("collection_authority");
const RESERVATION_SEED = textEncoder.encode("reservation");
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
const DEFAULT_PUBLIC_KEY = new PublicKey(SYSTEM_PROGRAM_ADDRESS);
const RETRYABLE_ERROR_PATTERNS = [/already in use/i, /constraint seeds/i, /reservation token/i];
const RETRYABLE_ERROR_CODES = new Set([6005, 6007]);

type DoomNftInstructionName = "mint_doom_index_nft" | "reserve_token_id";

interface IdlInstruction {
  discriminator: number[];
  name: string;
}

interface IdlAccount {
  discriminator: number[];
  name: string;
}

interface IdlError {
  code: number;
  msg: string;
  name: string;
}

export interface DoomGlobalConfig {
  admin: PublicKey;
  upgradeAuthority: PublicKey;
  nextTokenId: bigint;
  mintPaused: boolean;
  baseMetadataUrl: string;
  collection: PublicKey;
  collectionUpdateAuthority: PublicKey;
  bump: number;
}

const DOOM_IDL_INSTRUCTIONS = doomNftProgramIdl.instructions as IdlInstruction[];
const DOOM_IDL_ACCOUNTS = doomNftProgramIdl.accounts as IdlAccount[];
const DOOM_IDL_ERRORS = doomNftProgramIdl.errors as IdlError[];
const DOOM_MINT_INSTRUCTION = doomNftProgramIdl.instructions.find(
  (instruction) => instruction.name === "mint_doom_index_nft",
);
const DOOM_MPL_CORE_ACCOUNT = DOOM_MINT_INSTRUCTION?.accounts.find(
  (account): account is { address: string; name: string } =>
    "address" in account && account.name === "mpl_core_program",
);
const DOOM_MPL_CORE_ADDRESS = DOOM_MPL_CORE_ACCOUNT?.address ?? "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

export const DOOM_NFT_PROGRAM_ID = new PublicKey(doomNftProgramIdl.address);
export const MPL_CORE_PROGRAM_ID = new PublicKey(DOOM_MPL_CORE_ADDRESS);

const GLOBAL_CONFIG_ACCOUNT_DISCRIMINATOR = getAccountDiscriminator("GlobalConfig");
const MINT_DOOM_INDEX_NFT_DISCRIMINATOR = getInstructionDiscriminator("mint_doom_index_nft");
const RESERVE_TOKEN_ID_DISCRIMINATOR = getInstructionDiscriminator("reserve_token_id");
const DOOM_PROGRAM_ERRORS = new Map(DOOM_IDL_ERRORS.map((error) => [error.code, error.msg]));

function getInstructionDiscriminator(name: DoomNftInstructionName): Uint8Array {
  const discriminator = DOOM_IDL_INSTRUCTIONS.find((instruction) => instruction.name === name)?.discriminator;
  if (!discriminator) {
    throw new Error(`Missing discriminator for instruction ${name}.`);
  }

  return Uint8Array.from(discriminator);
}

function getAccountDiscriminator(name: string): Uint8Array {
  const discriminator = DOOM_IDL_ACCOUNTS.find((account) => account.name === name)?.discriminator;
  if (!discriminator) {
    throw new Error(`Missing discriminator for account ${name}.`);
  }

  return Uint8Array.from(discriminator);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes;
}

function toInstructionData(bytes: Uint8Array): Buffer {
  return Uint8Array.from(bytes) as unknown as Buffer;
}

function encodeU64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

function readPublicKey(data: Uint8Array, offset: number): [PublicKey, number] {
  return [new PublicKey(data.slice(offset, offset + 32)), offset + 32];
}

function readU64(data: Uint8Array, offset: number): [bigint, number] {
  return [new DataView(data.buffer, data.byteOffset + offset, 8).getBigUint64(0, true), offset + 8];
}

function readBool(data: Uint8Array, offset: number): [boolean, number] {
  return [data[offset] === 1, offset + 1];
}

function readString(data: Uint8Array, offset: number): [string, number] {
  const byteLength = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
  const start = offset + 4;
  const end = start + byteLength;
  return [new TextDecoder().decode(data.slice(start, end)), end];
}

function readU8(data: Uint8Array, offset: number): [number, number] {
  return [data[offset] ?? 0, offset + 1];
}

function ensureDiscriminator(data: Uint8Array, expectedDiscriminator: Uint8Array): void {
  const actual = data.slice(0, expectedDiscriminator.length);

  if (actual.length !== expectedDiscriminator.length) {
    throw new Error("Invalid account data: discriminator length mismatch.");
  }

  for (let index = 0; index < expectedDiscriminator.length; index++) {
    if (actual[index] !== expectedDiscriminator[index]) {
      throw new Error("Invalid account data: discriminator mismatch.");
    }
  }
}

function extractErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if ("logs" in error && Array.isArray(error.logs)) {
      return error.logs.filter((log): log is string => typeof log === "string").join("\n");
    }
  }

  return String(error);
}

function parseCustomProgramErrorCode(message: string): number | null {
  const hexadecimalMatch = /custom program error: (0x[0-9a-f]+)/i.exec(message);
  if (hexadecimalMatch?.[1]) {
    return Number.parseInt(hexadecimalMatch[1], 16);
  }

  const decimalMatch = /custom program error: (\d+)/i.exec(message);
  if (decimalMatch?.[1]) {
    return Number.parseInt(decimalMatch[1], 10);
  }

  return null;
}

export function decodeGlobalConfigAccount(data: Uint8Array): DoomGlobalConfig {
  ensureDiscriminator(data, GLOBAL_CONFIG_ACCOUNT_DISCRIMINATOR);

  let offset = GLOBAL_CONFIG_ACCOUNT_DISCRIMINATOR.length;
  const [admin, adminOffset] = readPublicKey(data, offset);
  offset = adminOffset;
  const [upgradeAuthority, upgradeAuthorityOffset] = readPublicKey(data, offset);
  offset = upgradeAuthorityOffset;
  const [nextTokenId, nextTokenIdOffset] = readU64(data, offset);
  offset = nextTokenIdOffset;
  const [mintPaused, mintPausedOffset] = readBool(data, offset);
  offset = mintPausedOffset;
  const [baseMetadataUrl, baseMetadataUrlOffset] = readString(data, offset);
  offset = baseMetadataUrlOffset;
  const [collection, collectionOffset] = readPublicKey(data, offset);
  offset = collectionOffset;
  const [collectionUpdateAuthority, collectionUpdateAuthorityOffset] = readPublicKey(data, offset);
  offset = collectionUpdateAuthorityOffset;
  const [bump] = readU8(data, offset);

  return {
    admin,
    baseMetadataUrl,
    bump,
    collection,
    collectionUpdateAuthority,
    mintPaused,
    nextTokenId,
    upgradeAuthority,
  };
}

export function deriveGlobalConfigPda(programId: PublicKey = DOOM_NFT_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([GLOBAL_CONFIG_SEED], programId)[0];
}

export function deriveCollectionUpdateAuthorityPda(
  globalConfig: PublicKey,
  programId: PublicKey = DOOM_NFT_PROGRAM_ID,
): PublicKey {
  return PublicKey.findProgramAddressSync([COLLECTION_AUTHORITY_SEED, globalConfig.toBytes()], programId)[0];
}

export function deriveReservationPda(tokenId: bigint, programId: PublicKey = DOOM_NFT_PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([RESERVATION_SEED, encodeU64LE(tokenId)], programId)[0];
}

export async function fetchGlobalConfig(
  connection: Pick<Connection, "getAccountInfo">,
  programId: PublicKey = DOOM_NFT_PROGRAM_ID,
): Promise<{ address: PublicKey; globalConfig: DoomGlobalConfig }> {
  const address = deriveGlobalConfigPda(programId);
  const accountInfo = await connection.getAccountInfo(address);

  if (!accountInfo) {
    throw new Error("Doom NFT global config is not initialized.");
  }

  return {
    address,
    globalConfig: decodeGlobalConfigAccount(accountInfo.data),
  };
}

export function validateGlobalConfigForMint(globalConfig: DoomGlobalConfig, globalConfigAddress: PublicKey): void {
  if (globalConfig.mintPaused) {
    throw new Error("Minting is currently paused.");
  }

  if (globalConfig.collection.equals(DEFAULT_PUBLIC_KEY)) {
    throw new Error("The Doom NFT collection is not initialized.");
  }

  const expectedCollectionAuthority = deriveCollectionUpdateAuthorityPda(globalConfigAddress);
  if (!globalConfig.collectionUpdateAuthority.equals(expectedCollectionAuthority)) {
    throw new Error("The Doom NFT collection authority is misconfigured.");
  }
}

export function buildReserveTokenIdInstruction(params: {
  globalConfig: PublicKey;
  reservation: PublicKey;
  user: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    data: toInstructionData(RESERVE_TOKEN_ID_DISCRIMINATOR),
    keys: [
      { isSigner: false, isWritable: true, pubkey: params.globalConfig },
      { isSigner: false, isWritable: true, pubkey: params.reservation },
      { isSigner: true, isWritable: true, pubkey: params.user },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId: params.programId ?? DOOM_NFT_PROGRAM_ID,
  });
}

export function buildMintDoomIndexNftInstruction(params: {
  asset: PublicKey;
  collection: PublicKey;
  collectionUpdateAuthority: PublicKey;
  globalConfig: PublicKey;
  reservation: PublicKey;
  tokenId: bigint;
  user: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    data: toInstructionData(concatBytes(MINT_DOOM_INDEX_NFT_DISCRIMINATOR, encodeU64LE(params.tokenId))),
    keys: [
      { isSigner: false, isWritable: false, pubkey: params.globalConfig },
      { isSigner: false, isWritable: true, pubkey: params.reservation },
      { isSigner: true, isWritable: true, pubkey: params.user },
      { isSigner: true, isWritable: true, pubkey: params.asset },
      { isSigner: false, isWritable: false, pubkey: params.collectionUpdateAuthority },
      { isSigner: false, isWritable: true, pubkey: params.collection },
      { isSigner: false, isWritable: false, pubkey: MPL_CORE_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId: params.programId ?? DOOM_NFT_PROGRAM_ID,
  });
}

export function buildDoomNftMintTransaction(params: {
  asset: PublicKey;
  collection: PublicKey;
  globalConfig: PublicKey;
  tokenId: bigint;
  user: PublicKey;
}): Transaction {
  const reservation = deriveReservationPda(params.tokenId);
  const collectionUpdateAuthority = deriveCollectionUpdateAuthorityPda(params.globalConfig);

  return new Transaction()
    .add(
      buildReserveTokenIdInstruction({
        globalConfig: params.globalConfig,
        reservation,
        user: params.user,
      }),
    )
    .add(
      buildMintDoomIndexNftInstruction({
        asset: params.asset,
        collection: params.collection,
        collectionUpdateAuthority,
        globalConfig: params.globalConfig,
        reservation,
        tokenId: params.tokenId,
        user: params.user,
      }),
    );
}

export function getDoomNftProgramErrorMessage(error: unknown): string | null {
  const message = extractErrorText(error);
  const code = parseCustomProgramErrorCode(message);

  if (code === null) {
    return null;
  }

  return DOOM_PROGRAM_ERRORS.get(code) ?? null;
}

export function isRetryableReservationRaceError(error: unknown): boolean {
  const message = extractErrorText(error);
  const code = parseCustomProgramErrorCode(message);

  if (code !== null && RETRYABLE_ERROR_CODES.has(code)) {
    return true;
  }

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
