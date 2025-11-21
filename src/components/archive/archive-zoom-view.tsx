"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import type { Painting } from "@/types/paintings";

interface ArchiveZoomViewProps {
  item: Painting | null;
  onClose: () => void;
}

export const ArchiveZoomView: React.FC<ArchiveZoomViewProps> = ({ item, onClose }) => {
  useEffect(() => {
    if (item) {
      // Disable scroll when zoom view is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [item]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && item) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, [item, onClose]);

  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-white/10 p-8 backdrop-blur-md"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition-colors hover:bg-white/30"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Image */}
          <div className="relative shrink-0">
            <Image
              src={item.imageUrl}
              alt={`Archive item ${item.id}`}
              width={800}
              height={600}
              className="max-h-[70vh] max-w-full rounded-lg object-contain"
            />
          </div>

          {/* Metadata */}
          <div className="min-w-0 flex-1 space-y-4 text-white">
            <h2 className="text-2xl font-bold">Archive Item Details</h2>

            <div className="space-y-2">
              <div>
                <span className="text-sm text-white/70">ID:</span>
                <p className="font-mono text-sm">{item.id}</p>
              </div>

              <div>
                <span className="text-sm text-white/70">Timestamp:</span>
                <p className="text-sm">{new Date(item.timestamp).toLocaleString()}</p>
              </div>

              <div>
                <span className="text-sm text-white/70">Seed:</span>
                <p className="font-mono text-sm">{item.seed}</p>
              </div>

              <div>
                <span className="text-sm text-white/70">Params Hash:</span>
                <p className="font-mono text-sm">{item.paramsHash}</p>
              </div>

              <div>
                <span className="text-sm text-white/70">File Size:</span>
                <p className="text-sm">{(item.fileSize / 1024).toFixed(2)} KB</p>
              </div>
            </div>

            {/* Market Cap Values */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Market Cap Values</h3>
              <div className="space-y-1">
                {Object.entries(item.mcRounded).map(([token, value]) => (
                  <div key={token} className="flex justify-between">
                    <span className="text-sm text-white/70">{token}:</span>
                    <span className="font-mono text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Visual Parameters */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Visual Parameters</h3>
              <div className="space-y-1">
                {Object.entries(item.visualParams).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-sm text-white/70">{key}:</span>
                    <span className="font-mono text-sm">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Prompts */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Prompt</h3>
              <p className="text-sm text-white/90">{item.prompt}</p>
            </div>

            {item.negative && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Negative Prompt</h3>
                <p className="text-sm text-white/90">{item.negative}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
