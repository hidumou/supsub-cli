// packages/cli/src/api/search.ts
import { request } from "../http/client.ts";
import type { SearchResponse } from "../lib/types.ts";

export type SearchAllParams = {
  type: "ALL" | "MP" | "WEBSITE" | "CONTENT";
  keywords: string;
  page: number;
  pageSize?: number;
};

/** GET /api/search — 全量搜索（源 + 内容） */
export async function searchAll(
  params: SearchAllParams,
): Promise<SearchResponse> {
  return request<SearchResponse>({
    method: "GET",
    path: "/api/search",
    query: {
      type: params.type,
      keywords: params.keywords,
      page: params.page,
      pageSize: params.pageSize ?? 10,
    },
  });
}
