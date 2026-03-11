import type { Painting } from "@/types/paintings";

export interface ArchiveListResponse {
  items: Painting[];
  cursor?: string;
  hasMore: boolean;
}
