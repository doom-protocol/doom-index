"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendGAEvent, GA_EVENTS } from "@/lib/analytics";

export const DateFilter: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";

  const updateURL = (newStartDate?: string, newEndDate?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newStartDate) {
      params.set("startDate", newStartDate);
    } else {
      params.delete("startDate");
    }
    if (newEndDate) {
      params.set("endDate", newEndDate);
    } else {
      params.delete("endDate");
    }
    params.delete("cursor"); // Reset cursor when filter changes
    const filterValue = newStartDate || newEndDate ? `${newStartDate || ""}-${newEndDate || ""}` : "cleared";
    sendGAEvent(GA_EVENTS.ARCHIVE_FILTER_CHANGE, { filter_type: "date", filter_value: filterValue });
    router.push(`/archive?${params.toString()}`);
  };

  const handleStartDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue !== startDate) {
      updateURL(newValue, endDate);
    }
  };

  const handleEndDateBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue !== endDate) {
      updateURL(startDate, newValue);
    }
  };

  const handleClear = () => {
    updateURL("", "");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/40 py-3 px-1.5 backdrop-blur-md md:p-3">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2.5 md:flex-row md:justify-center md:gap-2">
        <div className="w-full md:w-auto flex flex-row items-stretch justify-around md:flex-row md:items-center md:gap-2">
          <div className="flex items-center gap-1">
            <label htmlFor="startDate" className="text-[10px] text-white/70 md:text-xs whitespace-nowrap">
              From:
            </label>
            <input
              id="startDate"
              type="date"
              defaultValue={startDate}
              onBlur={handleStartDateBlur}
              className="w-30 rounded border border-white/20 bg-white/10 px-2 py-2 pr-8 text-xs text-white text-right backdrop-blur-sm transition-colors hover:border-white/30 focus:border-white/50 focus:outline-none md:w-36 md:px-2 md:py-1 md:text-sm md:pr-2 md:text-left"
            />
          </div>

          <div className="flex items-center gap-1">
            <label htmlFor="endDate" className="text-[10px] text-white/70 md:text-xs whitespace-nowrap">
              To:
            </label>
            <input
              id="endDate"
              type="date"
              defaultValue={endDate}
              onBlur={handleEndDateBlur}
              min={startDate || undefined}
              className="w-30 rounded border border-white/20 bg-white/10 px-2 py-2 pr-8 text-xs text-white text-right backdrop-blur-sm transition-colors hover:border-white/30 focus:border-white/50 focus:outline-none md:w-36 md:px-2 md:py-1 md:text-sm md:pr-2 md:text-left"
            />
          </div>
        </div>

        {(startDate || endDate) && (
          <button
            onClick={handleClear}
            className="rounded border border-white/20 bg-white/10 px-4 py-1 text-[10px] text-white transition-colors hover:bg-white/20 md:px-3 md:py-1 md:text-xs"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
