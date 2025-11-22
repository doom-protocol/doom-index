// Google Analytics event tracking utilities
import { sendGAEvent as nextSendGAEvent } from "@next/third-parties/google";

// Event name constants
export const GA_EVENTS = {
  GALLERY_PAINING_CLICK: "gallery_painting_click",
  ARCHIVE_PAINING_CLICK: "archive_painting_click",
  ARCHIVE_DETAIL_VIEW: "archive_detail_view",
  ARCHIVE_PAGE_CHANGE: "archive_page_change",
  ARCHIVE_FILTER_CHANGE: "archive_filter_change",
  MINT_BUTTON_CLICK: "mint_button_click",
  WHITEPAPER_VIEW: "whitepaper_view",
  PAGE_NAVIGATION: "page_navigation",
} as const;

export type GAEventName = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];

// GA event parameter types
type GAParameterValue = string | number | boolean | null | undefined;
export type GAEventParameters = Record<string, GAParameterValue>;

export const sendGAEvent = (eventName: GAEventName, parameters?: GAEventParameters) => {
  nextSendGAEvent("event", eventName, parameters || {});
};
