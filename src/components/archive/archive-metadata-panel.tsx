"use client";

import type { Painting } from "@/types/paintings";
import type { FC } from "react";

interface ArchiveMetadataPanelProps {
  item: Painting;
  className?: string;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${String(y)}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export const ArchiveMetadataPanel: FC<ArchiveMetadataPanelProps> = ({ item, className = "" }) => {
  return (
    <div className={`space-y-6 text-white ${className}`}>
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white/90 normal-case">Basic information</h3>
        <div className="space-y-2 rounded-lg bg-white/5 p-4">
          <div>
            <span className="text-sm text-white/70">Generated:</span>
            <p className="text-sm">{formatTimestamp(item.timestamp)}</p>
          </div>
          <div>
            <span className="text-sm text-white/70">ID:</span>
            <p className="font-mono text-sm">{item.id}</p>
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
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white/90 normal-case">Visual parameters</h3>
        <div className="space-y-1 rounded-lg bg-white/5 p-4">
          {Object.entries(item.visualParams).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-sm text-white/70">{key}:</span>
              <span className="font-mono text-sm">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-white/90 normal-case">Prompt</h3>
        <div className="rounded-lg bg-white/5 p-4">
          <p className="text-sm leading-relaxed text-white/90">{item.prompt}</p>
        </div>
      </div>

      {item.negative && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white/90 normal-case">Negative prompt</h3>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-sm leading-relaxed text-white/90">{item.negative}</p>
          </div>
        </div>
      )}
    </div>
  );
};
