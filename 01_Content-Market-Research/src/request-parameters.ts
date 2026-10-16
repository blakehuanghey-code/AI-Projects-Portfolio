import type { ApiAction, ResearchPlatform } from "./model.ts";

// 展示只保留一个接口映射，路径取自原项目；不提供请求入口。
export const ACTION_ENDPOINTS: Partial<Record<ApiAction, string>> = { xhs_search: "/api/v1/xiaohongshu/app_v2/search_notes" } as const;

// 源文件 app/lib/tikhub.ts，第 96 行：XhsSortType
export type XhsSortType = "general" | "time_descending" | "popularity_descending" | "comment_descending" | "collect_descending" | "english_preferred";

// 源文件 app/lib/tikhub.ts，第 97 行：WechatSortType
export type WechatSortType = "default" | "latest" | "hot";

// 源文件 app/lib/tikhub.ts，第 99 行：SearchFilters
export type SearchFilters = {
  xhs: {
    sortTypes: XhsSortType[];
    noteType: "不限" | "视频笔记" | "普通笔记" | "直播笔记";
    timeFilter: "不限" | "一天内" | "一周内" | "半年内";
  };
  wechat: {
    sorts: WechatSortType[];
    publishTime: "all" | "day" | "week" | "half_year";
  };
};

// 源文件 app/lib/tikhub.ts，第 111 行：SearchPagination
export type SearchPagination = {
  page?: number;
  searchId?: string;
  searchSessionId?: string;
  cursor?: string;
};

// 源文件 app/lib/tikhub.ts，第 118 行：DEFAULT_SEARCH_FILTERS
export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  xhs: { sortTypes: ["popularity_descending"], noteType: "不限", timeFilter: "一周内" },
  wechat: { sorts: ["hot"], publishTime: "week" },
};

// 源文件 app/lib/tikhub.ts，第 160 行：stableSignature
export function stableSignature(action: ApiAction, params: Record<string, unknown>) {
  const sorted = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  const readable = `${action}:${JSON.stringify(sorted)}`;
  if (readable.length <= 512) return readable;
  const bytes = new TextEncoder().encode(readable);
  const hashes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (const byte of bytes) for (let index = 0; index < hashes.length; index += 1) hashes[index] = Math.imul(hashes[index] ^ byte, 0x01000193) >>> 0;
  return `${action}:fnv1a128:${hashes.map((hash) => hash.toString(16).padStart(8, "0")).join("")}`;
}

// 源文件 app/lib/tikhub.ts，第 174 行：searchParams
export function searchParams(platform: ResearchPlatform, keyword: string, filters: SearchFilters, pagination: SearchPagination = {}, sortOverride?: XhsSortType | WechatSortType) {
  if (platform === "小红书") {
    return {
      keyword,
      page: pagination.page ?? 1,
      sort_type: sortOverride ?? filters.xhs.sortTypes[0] ?? "general",
      note_type: filters.xhs.noteType,
      time_filter: filters.xhs.timeFilter,
      search_id: pagination.searchId ?? "",
      search_session_id: pagination.searchSessionId ?? "",
      source: "explore_feed",
      ai_mode: 0,
    };
  }
  return {
    keyword,
    business_type: "article",
    sort: sortOverride ?? filters.wechat.sorts[0] ?? "default",
    publish_time: filters.wechat.publishTime,
    offset: 0,
    cursor: pagination.cursor ?? "",
    raw: false,
  };
}
