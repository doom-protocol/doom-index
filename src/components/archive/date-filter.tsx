"use client";

import { GA_EVENTS, sendGAEvent } from "@/lib/analytics";
import { useRouter } from "next/navigation";
import React from "react";

interface DateFilterProps {
  from?: string;
  to?: string;
}

export const DateFilter: React.FC<DateFilterProps> = ({ from = "", to = "" }) => {
  const router = useRouter();

  const updateURL = (newFrom?: string, newTo?: string) => {
    const params = new URLSearchParams();
    if (newFrom) {
      params.set("from", newFrom);
    }
    if (newTo) {
      params.set("to", newTo);
    }
    // page is reset implicitly by not including it

    const filterValue = newFrom || newTo ? `${newFrom || ""}-${newTo || ""}` : "cleared";
    sendGAEvent(GA_EVENTS.ARCHIVE_FILTER_CHANGE, { filter_type: "date", filter_value: filterValue });
    router.push(`/archive?${params.toString()}`);
  };

  const handlefromBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue !== from) {
      updateURL(newValue || undefined, to || undefined);
    }
  };

  const handletoBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue !== to) {
      updateURL(from || undefined, newValue || undefined);
    }
  };

  const handleClear = () => {
    updateURL("", "");
  };

  return (
    <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-white/10 bg-black/40 px-1.5 py-3 backdrop-blur-md md:p-3">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2.5 md:flex-row md:justify-center md:gap-2">
        <div className="flex w-full flex-row items-stretch justify-around md:w-auto md:flex-row md:items-center md:gap-2">
          <div className="flex items-center gap-1">
            <label htmlFor="from" className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">
              From:
            </label>
            <input
              id="from"
              type="date"
              defaultValue={from}
              onBlur={handlefromBlur}
              className="w-30 rounded border border-white/20 bg-white/10 px-2 py-2 pr-2 text-right text-[9px] text-white backdrop-blur-sm transition-colors hover:border-white/30 focus:border-white/50 focus:outline-none md:w-36 md:px-2 md:py-1 md:pr-1 md:text-left md:text-[11px]"
            />
          </div>

          <div className="flex items-center gap-1">
            <label htmlFor="to" className="text-[10px] whitespace-nowrap text-white/70 md:text-xs">
              To:
            </label>
            <input
              id="to"
              type="date"
              defaultValue={to}
              onBlur={handletoBlur}
              min={from || undefined}
              className="w-30 rounded border border-white/20 bg-white/10 px-2 py-2 pr-2 text-right text-[9px] text-white backdrop-blur-sm transition-colors hover:border-white/30 focus:border-white/50 focus:outline-none md:w-36 md:px-2 md:py-1 md:pr-1 md:text-left md:text-[11px]"
            />
          </div>
        </div>

        {(from || to) && (
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
