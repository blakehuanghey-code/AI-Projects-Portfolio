import type { Candidate, KeywordLevel, Metrics, ResearchPlatform, CollectionMode, Availability } from "./model.ts";
import { EMPTY_METRICS } from "./model.ts";

// 真实规范化函数选摘；仅移除私有评分调用、阈值说明与非选定平台主页推导。
// 源文件 app/lib/tikhub.ts，第 199 行：asRecord
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// 源文件 app/lib/tikhub.ts，第 201 行：pick
const pick = (obj: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  return undefined;
};

// 源文件 app/lib/tikhub.ts，第 205 行：asText
const asText = (value: unknown) => (value === undefined || value === null ? "" : String(value));

// 源文件 app/lib/tikhub.ts，第 206 行：cleanSearchText
export function cleanSearchText(value: unknown) {
  return asText(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (entity) => ({ "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[entity.toLowerCase()] ?? entity))
    .replace(/\s+/g, " ")
    .trim();
}

// 源文件 app/lib/tikhub.ts，第 215 行：isLikelyXhsId
export const isLikelyXhsId = (value: string) => /^[a-f0-9]{24}$/i.test(value);

// 源文件 app/lib/tikhub.ts，第 216 行：xhsSearchContentUrl
export function xhsSearchContentUrl(platformItemId: string, rawUrl: string, xsecToken: string) {
  if (!isLikelyXhsId(platformItemId)) return rawUrl;
  const baseUrl = /xiaohongshu\.com\/(?:discovery\/item|explore)\//i.test(rawUrl)
    ? rawUrl
    : `https://www.xiaohongshu.com/explore/${platformItemId}`;
  if (!xsecToken || /[?&]xsec_token=/i.test(baseUrl)) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set("xsec_token", xsecToken);
  url.searchParams.set("xsec_source", "pc_search");
  url.searchParams.set("source", "web_search_result_notes");
  return url.toString();
}

// 源文件 app/lib/tikhub.ts，第 241 行：preferredXhsAccountId
export function preferredXhsAccountId(current: string, incoming: string) {
  if (isLikelyXhsId(incoming)) return incoming;
  if (isLikelyXhsId(current)) return current;
  return incoming || current;
}

// 源文件 app/lib/tikhub.ts，第 247 行：CandidateKeywordScope
export type CandidateKeywordScope = KeywordLevel | "下拉词";

// 源文件 app/lib/tikhub.ts，第 280 行：asNumber
const asNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") return null;
  const normalized = typeof value === "string" ? value.replaceAll(",", "").trim() : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

// 源文件 app/lib/tikhub.ts，第 286 行：asDate
const asDate = (value: unknown) => {
  if (!value) return "";
  const raw = asText(value);
  if (/^\d{10,13}$/.test(raw)) {
    const stamp = raw.length === 10 ? Number(raw) * 1000 : Number(raw);
    return new Date(stamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return raw.slice(0, 10);
};

// 源文件 app/lib/tikhub.ts，第 296 行：findContentRecord
function findContentRecord(payload: unknown, platformItemId: string) {
  if (!platformItemId) return {} as Record<string, unknown>;
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) { queue.push(...current); continue; }
    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    const recordId = asText(pick(record, ["note_id", "noteId", "article_id", "articleId", "id"]));
    const hasContentFields = pick(record, ["title", "display_title", "desc", "description", "publish_time", "published_at", "create_time", "createTime", "timestamp", "time", "date", "share_info", "shareInfo"]) !== undefined;
    if (recordId === platformItemId && hasContentFields) return record;
    queue.push(...Object.values(record).filter((value) => value && typeof value === "object"));
  }
  return {} as Record<string, unknown>;
}

// 源文件 app/lib/tikhub.ts，第 315 行：validImageUrl
function validImageUrl(value: unknown) {
  const url = asText(value).trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

// 源文件 app/lib/tikhub.ts，第 320 行：imageUrlFromValue
function imageUrlFromValue(value: unknown): string {
  const direct = validImageUrl(value);
  if (direct) return direct;
  const record = asRecord(value);
  const multiLevel = asRecord(pick(record, ["url_multi_level", "urlMultiLevel"]));
  for (const key of ["low", "medium", "high"]) {
    const found = validImageUrl(multiLevel[key]);
    if (found) return found;
  }
  for (const key of ["thumbnail_dim", "thumbnailDim", "first_frame", "firstFrame", "url", "url_default", "urlDefault", "url_size_pre", "urlSizePre", "thumbnail", "url_size_large", "urlSizeLarge", "original", "image"]) {
    const found = validImageUrl(record[key]);
    if (found) return found;
  }
  const infoList = pick(record, ["info_list", "infoList"]);
  if (Array.isArray(infoList)) {
    for (const item of infoList) {
      const found = imageUrlFromValue(item);
      if (found) return found;
    }
  }
  return "";
}

// 源文件 app/lib/tikhub.ts，第 343 行：coverUrlFromRecord
function coverUrlFromRecord(record: Record<string, unknown>) {
  const directCover = imageUrlFromValue(pick(record, ["thumbUrl", "thumb_url", "cover_url", "coverUrl"]));
  if (directCover) return directCover;
  const video = asRecord(pick(record, ["video_info_v2", "videoInfoV2", "video_info", "videoInfo"]));
  const videoCover = imageUrlFromValue(pick(video, ["image", "cover", "thumbnail"]));
  if (videoCover) return videoCover;

  const images = pick(record, ["images_list", "imagesList", "image_list", "imageList", "images"]);
  if (Array.isArray(images) && images.length) {
    const rawIndex = asNumber(pick(record, ["cover_image_index", "coverImageIndex"]));
    const index = rawIndex !== null && rawIndex >= 0 && rawIndex < images.length ? rawIndex : 0;
    const preferred = imageUrlFromValue(images[index]);
    if (preferred) return preferred;
    for (const image of images) {
      const found = imageUrlFromValue(image);
      if (found) return found;
    }
  }

  const share = asRecord(pick(record, ["share_info", "shareInfo"]));
  const shareCover = imageUrlFromValue(pick(share, ["image", "cover", "thumbnail"]));
  if (shareCover) return shareCover;
  const miniProgram = asRecord(pick(record, ["mini_program_info", "miniProgramInfo", "qq_mini_program_info", "qqMiniProgramInfo"]));
  return imageUrlFromValue(pick(miniProgram, ["thumb", "image", "cover"]));
}

// 源文件 app/lib/tikhub.ts，第 369 行：extractCoverUrl
export function extractCoverUrl(payload: unknown, platformItemId = "") {
  if (platformItemId) return coverUrlFromRecord(findContentRecord(payload, platformItemId));
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) { queue.push(...current); continue; }
    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    const coverUrl = coverUrlFromRecord(record);
    if (coverUrl) return coverUrl;
    queue.push(...Object.values(record).filter((value) => value && typeof value === "object"));
  }
  return "";
}

// 源文件 app/lib/tikhub.ts，第 387 行：findArray
function findArray(payload: unknown, keys: string[]): unknown[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) return current;
    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
    for (const value of Object.values(record)) if (value && typeof value === "object") queue.push(value);
  }
  return [];
}

// 源文件 app/lib/tikhub.ts，第 403 行：findDeepValue
function findDeepValue(payload: unknown, keys: string[], allowEmpty = false) {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (Array.isArray(current)) { queue.push(...current); continue; }
    if (typeof current !== "object") continue;
    const record = current as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && (allowEmpty || value !== "")) return value;
    }
    const nested = Object.entries(record).filter(([, value]) => value && typeof value === "object");
    queue.push(...nested.filter(([key]) => key === "data").map(([, value]) => value));
    queue.push(...nested.filter(([key]) => key !== "data" && key !== "params").map(([, value]) => value));
  }
  return undefined;
}

// 源文件 app/lib/tikhub.ts，第 424 行：extractSearchPagination
export function extractSearchPagination(platform: ResearchPlatform, payload: unknown) {
  const rawHasMore = findDeepValue(payload, ["has_more", "hasMore", "continue_flag", "continueFlag"], true);
  const hasMore = rawHasMore === undefined ? undefined : rawHasMore === true || rawHasMore === 1 || rawHasMore === "1" || rawHasMore === "true";
  return {
    searchId: asText(findDeepValue(payload, ["search_id", "searchId"])),
    searchSessionId: asText(findDeepValue(payload, ["search_session_id", "searchSessionId"])),
    cursor: asText(findDeepValue(payload, ["cursor", "next_cursor", "nextCursor"])),
    hasMore,
  };
}

// 源文件 app/lib/tikhub.ts，第 435 行：metricsFrom
function metricsFrom(record: Record<string, unknown>): Metrics {
  const nested = asRecord(pick(record, ["interact_info", "interactInfo", "statistics", "stats", "metrics"]));
  const source = { ...record, ...nested };
  return {
    views: asNumber(pick(source, ["view_count", "viewCount", "play_count", "playCount"])),
    reads: asNumber(pick(source, ["read_num", "read_count", "readCount", "reads"])),
    likes: asNumber(pick(source, ["liked_count", "like_count", "like_num", "likes", "likeCount", "old_like_count"])),
    saves: asNumber(pick(source, ["collected_count", "collect_count", "favorite_count", "saves", "collectCount"])),
    comments: asNumber(pick(source, ["comment_count", "comments_count", "comments", "commentCount", "commentsCount"])),
    shares: asNumber(pick(source, ["share_count", "share_num", "shares", "shareCount"])),
    reposts: asNumber(pick(source, ["repost_count", "forward_count", "reposts", "forwardCount"])),
  };
}

// 源文件 app/lib/tikhub.ts，第 449 行：compactChineseNumber
function compactChineseNumber(value: string) {
  const match = value.replaceAll(",", "").match(/(\d+(?:\.\d+)?)\s*(万|亿)?/);
  if (!match) return null;
  const multiplier = match[2] === "亿" ? 100_000_000 : match[2] === "万" ? 10_000 : 1;
  const parsed = Number(match[1]) * multiplier;
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

// 源文件 app/lib/tikhub.ts，第 457 行：wechatTagMetrics
function wechatTagMetrics(source: Record<string, unknown>): Metrics {
  const metrics = { ...EMPTY_METRICS };
  const tags = Array.isArray(source.tag) ? source.tag : [];
  for (const raw of tags) {
    const label = cleanSearchText(asRecord(raw).title);
    const value = compactChineseNumber(label);
    if (value === null) continue;
    if (/阅读|浏览/.test(label)) metrics.reads = value;
    else if (/点赞|喜欢|在看/.test(label)) metrics.likes = value;
    else if (/评论/.test(label)) metrics.comments = value;
    else if (/分享|转发/.test(label)) metrics.shares = value;
    else if (/收藏/.test(label)) metrics.saves = value;
  }
  return metrics;
}

// 源文件 app/lib/tikhub.ts，第 473 行：hasAnyMetric
function hasAnyMetric(metrics: Metrics) {
  return Object.values(metrics).some((value) => value !== null);
}

// 源文件 app/lib/tikhub.ts，第 477 行：mergeMetrics
export function mergeMetrics(base: Metrics, incoming: Metrics): Metrics {
  return Object.fromEntries(Object.keys(EMPTY_METRICS).map((key) => [key, incoming[key as keyof Metrics] ?? base[key as keyof Metrics]])) as Metrics;
}

// 源文件 app/lib/tikhub.ts，第 481 行：metricAvailabilityFor
export function metricAvailabilityFor(platform: ResearchPlatform, metrics: Metrics): Availability {
  const required = platform === "小红书"
    ? [metrics.likes, metrics.saves, metrics.comments]
    : [metrics.reads ?? metrics.views, metrics.likes, metrics.comments, metrics.shares ?? metrics.reposts];
  const present = required.filter((value) => value !== null).length;
  return present === 0 ? "待补齐" : present === required.length ? "已获取" : "部分获取";
}

// 源文件 app/lib/tikhub.ts，第 489 行：baseClassification
function baseClassification(track: string, secondaryTheme: string): Candidate["classification"] {
  return {
    track,
    secondaryTheme,
    tertiaryTheme: "",
    contentType: "待分类",
    sampleTags: "",
    lowFollowerViral: "待判断",
    lowFollowerRule: "展示版未收录评分规则",
    contentAngle: "",
    painPoint: "",
    solution: "",
    practiceEvidence: "",
    hook: "",
    businessSignal: "",
    evidenceLevel: "待核验",
    reviewStatus: "待分析",
    analystNote: "",
  };
}

// 源文件 app/lib/tikhub.ts，第 510 行：normalizeSearchResults
export function normalizeSearchResults(
  platform: ResearchPlatform,
  payload: unknown,
  context: { keywordId: string; keyword: string; keywordLevel: KeywordLevel; searchScope?: CandidateKeywordScope; track: string; secondaryTheme: string; mode: CollectionMode },
): Candidate[] {
  const rows = findArray(payload, platform === "小红书" ? ["items", "notes", "note_list"] : ["items", "articles", "list", "search_result"]);
  return rows.map((raw, index) => {
    const row = asRecord(raw);
    const note = asRecord(pick(row, ["note_card", "noteCard", "note", "article", "item"]));
    const combined = { ...row, ...note };
    const jump = asRecord(pick(combined, ["jump_info", "jumpInfo"]));
    const source = asRecord(combined.source);
    const user = asRecord(pick(combined, ["user", "author", "user_info", "userInfo", "account", "mp_info"]) ?? source);
    const url = asText(pick(combined, ["url", "doc_url", "docUrl", "share_url", "shareUrl", "link", "jump_url", "jumpUrl"]) ?? pick(jump, ["url", "jump_url", "jumpUrl"]));
    const articleId = asText(pick(combined, ["article_id", "articleId", "docID", "docId", "appmsgid", "mid"]));
    const articleIndex = asText(pick(combined, ["idx", "item_index", "itemIndex"]));
    const id = platform === "小红书"
      ? asText(pick(combined, ["note_id", "noteId", "id"])) || `rank-${index + 1}`
      : articleId ? `${articleId}:${articleIndex || "1"}` : url || `rank-${index + 1}`;
    const accountId = asText(pick(user, ["user_id", "userId", "userid", "uid", "id", "username", "fakeid", "srcUserName"]) ?? pick(combined, ["user_id", "userId", "userid", "uid", "author_id", "authorId", "username", "fakeid", "srcUserName", "bizUin"]) ?? pick(jump, ["user_id", "userId", "userid", "uid", "username", "fakeid"]));
    const accountName = cleanSearchText(pick(user, ["nickname", "nick_name", "name", "account_name", "title"]) ?? pick(combined, ["nickname", "account_name", "author_name"]) ?? pick(jump, ["nickname", "nick_name", "name"]));
    const followers = asNumber(pick(user, ["fans", "fans_count", "follower_count", "followers"]) ?? pick(combined, ["fans", "fans_count", "follower_count", "followers"]));
    const accountNoteCount = asNumber(pick(user, ["notes", "note_count", "notes_count", "noteCount", "posted_note_count", "postedNoteCount", "note_num", "noteNum"]) ?? pick(combined, ["notes", "note_count", "notes_count", "noteCount", "posted_note_count", "postedNoteCount", "note_num", "noteNum"]));
    const metrics = mergeMetrics(metricsFrom(combined), platform === "公众号" ? wechatTagMetrics(source) : EMPTY_METRICS);
    const resolvedUrl = platform === "小红书"
      ? xhsSearchContentUrl(id, url, asText(pick(combined, ["xsec_token", "xsecToken"])))
      : url;
    const itemTypeRaw = asText(pick(combined, ["note_type", "type", "content_type"])).toLowerCase();
    const itemType = platform === "公众号" ? "article" : itemTypeRaw.includes("video") || itemTypeRaw.includes("视频") ? "video" : itemTypeRaw ? "image" : "unknown";
    const classification = baseClassification(context.track, context.secondaryTheme);
    // 展示适配：私有阈值不入包，保留 baseClassification 的待判断状态。
    return {
      id: `${platform}:${id}`,
      platform,
      platformItemId: id,
      itemType,
      keywordId: context.keywordId,
      keyword: context.keyword,
      keywordLevel: context.keywordLevel,
      searchQueries: [`${context.searchScope ?? context.keywordLevel}｜${context.keyword}`],
      track: context.track,
      secondaryTheme: context.secondaryTheme,
      title: cleanSearchText(pick(combined, ["title", "display_title", "name"])),
      excerpt: cleanSearchText(pick(combined, ["desc", "description", "summary", "content"])).slice(0, 240),
      coverUrl: extractCoverUrl(combined),
      publishedAt: asDate(pick(combined, ["publish_time", "published_at", "create_time", "createTime", "timestamp", "time", "date"])),
      url: resolvedUrl,
      accountId,
      accountName,
      accountNoteCount,
      followers,
      followersAvailability: followers !== null ? "已获取" : platform === "公众号" ? "平台未提供" : "待补齐",
      profileUrl: asText(pick(user, ["profile_url", "profileUrl", "url"])) || (platform === "小红书" && accountId ? `https://www.xiaohongshu.com/user/profile/${accountId}` : platform === "公众号" ? "" /* 展示范围外的公众号主页推导已省略 */ : ""),
      metrics,
      metricAvailability: metricAvailabilityFor(platform, metrics),
      metricSource: hasAnyMetric(metrics) ? "搜索结果" : "待补齐",
      searchRank: index + 1,
      collectedAt: new Date().toISOString(),
      sourceMode: context.mode,
      isMock: false,
      status: "候选",
      selected: false,
      body: "",
      bodyFetched: false,
      commentsData: [],
      commentsFetched: false,
      accountFetched: followers !== null,
      statsFetched: false,
      requestSignatures: [],
      classification,
    } satisfies Candidate;
  }).filter((candidate) => candidate.title || candidate.url || !candidate.platformItemId.startsWith("rank-"));
}

// 源文件 app/lib/tikhub.ts，第 584 行：mergeCandidates
export function mergeCandidates(existing: Candidate[], incoming: Candidate[]) {
  const map = new Map(existing.map((candidate) => [candidate.id, candidate]));
  const platformItemIds = new Map(existing.filter((candidate) => candidate.platformItemId && !candidate.platformItemId.startsWith("rank-")).map((candidate) => [`${candidate.platform}:${candidate.platformItemId}`, candidate.id]));
  for (const candidate of incoming) {
    const existingId = map.has(candidate.id) ? candidate.id : platformItemIds.get(`${candidate.platform}:${candidate.platformItemId}`);
    const old = existingId ? map.get(existingId) : undefined;
    if (!old) map.set(candidate.id, candidate);
    else {
      const metrics = mergeMetrics(old.metrics, candidate.metrics);
      map.set(old.id, {
        ...candidate,
        ...old,
      platformItemId: candidate.platformItemId || old.platformItemId,
      title: old.title || candidate.title,
      excerpt: old.excerpt || candidate.excerpt,
      coverUrl: old.coverUrl || candidate.coverUrl,
      body: old.body || candidate.body,
      bodyFetched: old.bodyFetched || candidate.bodyFetched,
      wechatCommentId: old.wechatCommentId || candidate.wechatCommentId,
      commentsData: (old.commentsData ?? []).length ? old.commentsData : candidate.commentsData,
      commentsFetched: old.commentsFetched || candidate.commentsFetched,
      publishedAt: old.publishedAt || candidate.publishedAt,
      itemType: old.itemType === "unknown" ? candidate.itemType : old.itemType,
      url: old.url || candidate.url,
      accountId: preferredXhsAccountId(old.accountId, candidate.accountId),
      accountName: old.accountName || candidate.accountName,
      accountNoteCount: old.accountNoteCount ?? candidate.accountNoteCount ?? null,
      followers: old.followers ?? candidate.followers,
      followersAvailability: old.followers !== null || candidate.followers !== null ? "已获取" : candidate.platform === "公众号" ? "平台未提供" : "待补齐",
      profileUrl: old.profileUrl || candidate.profileUrl,
      metrics,
      metricAvailability: metricAvailabilityFor(candidate.platform, metrics),
      metricSource: old.metricSource === "详情接口" || old.metricSource === "互动接口" ? old.metricSource : candidate.metricSource,
      accountFetched: old.accountFetched || candidate.accountFetched || old.followers !== null || candidate.followers !== null,
      statsFetched: old.statsFetched || candidate.statsFetched,
      searchSorts: [...new Set([...(old.searchSorts ?? []), ...(candidate.searchSorts ?? [])])],
      searchQueries: [...new Set([...(old.searchQueries ?? [`${old.keywordLevel ?? "三级"}｜${old.keyword}`]), ...(candidate.searchQueries ?? [`${candidate.keywordLevel ?? "三级"}｜${candidate.keyword}`])])],
      requestSignatures: [...new Set([...old.requestSignatures, ...candidate.requestSignatures])],
      });
    }
  }
  return [...map.values()].sort((a, b) => (b.metrics.likes ?? -1) - (a.metrics.likes ?? -1));
}
