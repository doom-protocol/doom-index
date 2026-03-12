import type { AppError } from "@/types/app-error";
import { getBaseUrl } from "@/utils/url";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import * as path from "node:path";

export interface LoadedAsset {
  bytes: Uint8Array;
  contentType: string;
  source: string;
}

const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
};

function getPathname(pathOrUrl: string): string {
  return new URL(pathOrUrl, "https://doomindex.fun").pathname;
}

function getExtension(pathOrUrl: string): string {
  const pathname = getPathname(pathOrUrl).toLowerCase();
  const lastSlashIndex = pathname.lastIndexOf("/");
  const lastDotIndex = pathname.lastIndexOf(".");

  if (lastDotIndex <= lastSlashIndex) {
    return "";
  }

  return pathname.slice(lastDotIndex);
}

export function inferContentTypeFromPath(pathOrUrl: string): string {
  const extension = getExtension(pathOrUrl);
  return CONTENT_TYPES_BY_EXTENSION[extension] ?? DEFAULT_CONTENT_TYPE;
}

function isRemoteAssetPath(pathOrUrl: string): boolean {
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

async function readLocalAsset(path: string): Promise<Uint8Array> {
  const { readFile } = await import("node:fs/promises");
  const file = await readFile(path);
  return new Uint8Array(file);
}

function resolveLocalPublicAssetPath(assetPath: `/${string}`): Result<string, AppError> {
  if (typeof process === "undefined" || typeof process.cwd !== "function") {
    return err({
      type: "StorageError",
      key: assetPath,
      message: `Cannot resolve local public asset ${assetPath} outside a Node-compatible runtime`,
      op: "get",
    });
  }

  const trimmedPath = assetPath.replace(/^\/+/, "").replaceAll("\\", "/");
  const normalizedPath = path.posix.normalize(trimmedPath);
  if (
    normalizedPath === "" ||
    normalizedPath === "." ||
    normalizedPath.startsWith("..") ||
    normalizedPath.includes("/..") ||
    normalizedPath.includes("\\..")
  ) {
    return err({
      type: "StorageError",
      key: assetPath,
      message: `Cannot resolve public asset ${assetPath}: path escapes or is outside the public directory`,
      op: "get",
    });
  }

  return ok(path.join(process.cwd(), "public", normalizedPath));
}

export async function loadAssetFromPathOrUrl(
  pathOrUrl: string,
  fallbackContentType: string = inferContentTypeFromPath(pathOrUrl),
): Promise<Result<LoadedAsset, AppError>> {
  try {
    if (isRemoteAssetPath(pathOrUrl)) {
      const response = await fetch(pathOrUrl);
      if (!response.ok) {
        return err({
          type: "StorageError",
          key: pathOrUrl,
          message: `Failed to fetch ${pathOrUrl}: ${String(response.status)} ${response.statusText}`,
          op: "get",
          status: response.status,
        });
      }

      return ok({
        bytes: await readResponseBytes(response),
        contentType: response.headers.get("content-type") ?? fallbackContentType,
        source: pathOrUrl,
      });
    }

    return ok({
      bytes: await readLocalAsset(pathOrUrl),
      contentType: fallbackContentType,
      source: pathOrUrl,
    });
  } catch (error) {
    return err({
      type: "StorageError",
      key: pathOrUrl,
      message: `Failed to load asset ${pathOrUrl}: ${error instanceof Error ? error.message : String(error)}`,
      op: "get",
    });
  }
}

export async function loadPublicAsset(params: {
  assetsFetcher?: Fetcher;
  path: `/${string}`;
}): Promise<Result<LoadedAsset, AppError>> {
  const fallbackContentType = inferContentTypeFromPath(params.path);

  if (params.assetsFetcher) {
    try {
      const request = new Request(new URL(params.path, getBaseUrl()).toString(), { method: "GET" });
      const response = await params.assetsFetcher.fetch(request);
      if (!response.ok) {
        return err({
          type: "StorageError",
          key: params.path,
          message: `Failed to fetch public asset ${params.path}: ${String(response.status)}`,
          op: "get",
          status: response.status,
        });
      }

      return ok({
        bytes: await readResponseBytes(response),
        contentType: response.headers.get("content-type") ?? fallbackContentType,
        source: params.path,
      });
    } catch (error) {
      return err({
        type: "StorageError",
        key: params.path,
        message: `Failed to fetch public asset ${params.path}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        op: "get",
      });
    }
  }

  const localPath = resolveLocalPublicAssetPath(params.path);
  if (localPath.isErr()) {
    return err(localPath.error);
  }

  return loadAssetFromPathOrUrl(localPath.value, fallbackContentType);
}
