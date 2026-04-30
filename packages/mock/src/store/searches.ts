import { randomUUID } from "../lib/id.js";
import { sources } from "../fixtures/sources.js";

export interface SearchRecord {
  searchId: string;
  name: string;
  createdAt: number; // ms
  cancelled: boolean;
}

const searches = new Map<string, SearchRecord>();

export function createSearch(name: string): SearchRecord {
  const searchId = randomUUID();
  const record: SearchRecord = {
    searchId,
    name,
    createdAt: Date.now(),
    cancelled: false,
  };
  searches.set(searchId, record);
  return record;
}

export function getSearch(id: string): SearchRecord | undefined {
  return searches.get(id);
}

export function cancelSearch(id: string): boolean {
  const record = searches.get(id);
  if (!record) return false;
  searches.delete(id);
  return true;
}

export interface SearchResult {
  finished: boolean;
  message: string;
  mp: {
    mpId: string;
    name: string;
    img: string;
    description: string;
  } | null;
}

/** Evaluate search state based on elapsed time and fixture matching */
export function evaluateSearch(record: SearchRecord): SearchResult {
  const elapsed = Date.now() - record.createdAt;

  // Find matching MP source (case-insensitive substring match)
  const lowerName = record.name.toLowerCase();
  const matched = sources.find(
    (s) =>
      s.sourceType === "MP" &&
      s.name.toLowerCase().includes(lowerName),
  );

  if (matched) {
    // Hit: finished after 3s
    if (elapsed >= 3000) {
      return {
        finished: true,
        message: "ok",
        mp: {
          mpId: String(matched.sourceId),
          name: matched.name,
          img: matched.img,
          description: matched.description,
        },
      };
    }
  } else {
    // Miss: finished after 5s
    if (elapsed >= 5000) {
      return {
        finished: true,
        message: "未找到",
        mp: null,
      };
    }
  }

  return {
    finished: false,
    message: "搜索中",
    mp: null,
  };
}
