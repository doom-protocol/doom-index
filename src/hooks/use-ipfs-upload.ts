/**
 * useIpfsUpload Hook
 *
 * Handles IPFS upload flow:
 * 1. Get signed URL from tRPC
 * 2. Upload GLB to Pinata
 * 3. Build metadata with GLB CID
 * 4. Upload metadata to Pinata
 * 5. Return both CIDs
 */

import { useState, useCallback } from "react";
import { useTRPCClient } from "@/lib/trpc/client";
import { buildNftMetadata, type BuildMetadataParams } from "@/lib/metadata-builder";
import { logger } from "@/utils/logger";

/**
 * IPFS upload result
 */
export interface IpfsUploadResult {
  cidGlb: string;
  cidMetadata: string;
  sizeGlb: number;
  sizeMetadata: number;
}

/**
 * IPFS upload error
 */
export interface IpfsUploadError {
  message: string;
  details?: unknown;
}

/**
 * useIpfsUpload hook result
 */
export interface UseIpfsUploadResult {
  uploadGlbAndMetadata: (
    glbFile: File,
    metadataParams: Omit<BuildMetadataParams, "cidGlb">,
  ) => Promise<IpfsUploadResult>;
  isUploading: boolean;
  progress: number;
  error: IpfsUploadError | null;
  reset: () => void;
}

/**
 * Pinata upload response
 */
interface PinataUploadResponse {
  data: {
    id: string;
    name: string;
    cid: string;
    size: number;
    number_of_files: number;
    mime_type: string;
    group_id: string | null;
  };
}

/**
 * Upload file to Pinata using signed URL
 */
async function uploadToPinata(file: File, signedUrl: string): Promise<{ cid: string; size: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(signedUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  const data = (await response.json()) as PinataUploadResponse;
  return {
    cid: data.data.cid,
    size: data.data.size,
  };
}

/**
 * Hook for uploading GLB and metadata to IPFS via Pinata
 *
 * @returns Upload functions and state
 */
export function useIpfsUpload(): UseIpfsUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<IpfsUploadError | null>(null);

  const client = useTRPCClient();

  const uploadGlbAndMetadata = useCallback(
    async (glbFile: File, metadataParams: Omit<BuildMetadataParams, "cidGlb">): Promise<IpfsUploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        // Step 1: Get signed URL for GLB
        logger.info("ipfs.upload.glb.start", { filename: glbFile.name, size: glbFile.size });
        setProgress(10);

        const glbSignedUrlResult = await client.ipfs.createSignedUploadUrl.mutate({
          filename: glbFile.name,
          contentType: "application/octet-stream",
          keyvalues: {
            timestamp: metadataParams.timestamp,
            paintingHash: metadataParams.paintingHash,
            network: "devnet",
            walletAddress: metadataParams.walletAddress,
          },
        });

        setProgress(20);

        // Step 2: Upload GLB to Pinata
        logger.info("ipfs.upload.glb.uploading", { url: glbSignedUrlResult.url });
        const { cid: cidGlb, size: sizeGlb } = await uploadToPinata(glbFile, glbSignedUrlResult.url);
        logger.info("ipfs.upload.glb.success", { cid: cidGlb, size: sizeGlb });
        setProgress(60);

        // Step 3: Build metadata with GLB CID
        const metadata = buildNftMetadata({
          ...metadataParams,
          cidGlb,
        });

        // Step 4: Get signed URL for metadata
        const metadataJson = JSON.stringify(metadata);
        const metadataBlob = new Blob([metadataJson], { type: "application/json" });
        const metadataFile = new File([metadataBlob], `metadata_${metadataParams.paintingHash}.json`, {
          type: "application/json",
        });

        logger.info("ipfs.upload.metadata.start", { size: metadataFile.size });
        setProgress(70);

        const metadataSignedUrlResult = await client.ipfs.createSignedUploadUrl.mutate({
          filename: metadataFile.name,
          contentType: "application/json",
          keyvalues: {
            timestamp: metadataParams.timestamp,
            paintingHash: metadataParams.paintingHash,
            network: "devnet",
          },
        });

        setProgress(80);

        // Step 5: Upload metadata to Pinata
        logger.info("ipfs.upload.metadata.uploading", { url: metadataSignedUrlResult.url });
        const { cid: cidMetadata, size: sizeMetadata } = await uploadToPinata(
          metadataFile,
          metadataSignedUrlResult.url,
        );
        logger.info("ipfs.upload.metadata.success", { cid: cidMetadata, size: sizeMetadata });
        setProgress(100);

        setIsUploading(false);

        return {
          cidGlb,
          cidMetadata,
          sizeGlb,
          sizeMetadata,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error("ipfs.upload.error", { error: errorMessage, details: err });

        const uploadError: IpfsUploadError = {
          message: errorMessage,
          details: err,
        };

        setError(uploadError);
        setIsUploading(false);
        setProgress(0);

        throw uploadError;
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    uploadGlbAndMetadata,
    isUploading,
    progress,
    error,
    reset,
  };
}
