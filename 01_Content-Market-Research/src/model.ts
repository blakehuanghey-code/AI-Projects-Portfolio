// 源文件 app/lib/model.ts，第 1 行：ResearchPlatform
export type ResearchPlatform = "小红书" | "公众号";

// 源文件 app/lib/model.ts，第 2 行：KeywordLevel
export type KeywordLevel = "一级" | "二级" | "三级";

// 源文件 app/lib/model.ts，第 4 行：ClassificationSource
export type ClassificationSource = "标题" | "摘要" | "正文" | "人工" | "AI复核";

// 源文件 app/lib/model.ts，第 5 行：AiReview
export type AiReview = { version: number; inputHash: string; reviewedAt: string; model: string; changedFields: string[] };

// 源文件 app/lib/model.ts，第 6 行：CollectionMode
export type CollectionMode = "平台条件" | "市场扫描" | "7天爆款";

// 源文件 app/lib/model.ts，第 7 行：CandidateStatus
export type CandidateStatus = "候选" | "已选择" | "已收录" | "已排除";

// 源文件 app/lib/model.ts，第 8 行：Availability
export type Availability = "已获取" | "部分获取" | "待补齐" | "平台未提供";

// 源文件 app/lib/model.ts，第 10 行：Metrics
export type Metrics = {
  views: number | null;
  reads: number | null;
  likes: number | null;
  saves: number | null;
  comments: number | null;
  shares: number | null;
  reposts: number | null;
};

// 源文件 app/lib/model.ts，第 20 行：Candidate
export type Candidate = {
  // 展示适配：省略本次未选取的公众号异常值扩展字段。
  id: string;
  platform: ResearchPlatform;
  platformItemId: string;
  itemType: "image" | "video" | "article" | "unknown";
  keywordId: string;
  keyword: string;
  keywordLevel?: KeywordLevel;
  searchQueries?: string[];
  track: string;
  secondaryTheme: string;
  title: string;
  excerpt: string;
  coverUrl?: string;
  publishedAt: string;
  url: string;
  accountId: string;
  accountName: string;
  accountNoteCount?: number | null;
  followers: number | null;
  followersAvailability: Availability;
  accountRegisteredAt?: string;
  accountRegisteredAvailability?: Availability;
  accountRegisteredFetchedAt?: string;
  realtimeFollowersFetchedAt?: string;
  wechatCommentId?: string;
  wechatAccountEnrichment?: {
    provider: "极致了";
    industryId: 7;
    industryName: "科技";
    period: "月榜";
    rank: number;
    wxid: string;
    jzlIndex: number | null;
    rankFetchedAt: string;
    followersFetchedAt?: string;
  };
  profileUrl: string;
  metrics: Metrics;
  metricAvailability: Availability;
  metricSource: "搜索结果" | "互动接口" | "详情接口" | "模拟数据" | "待补齐";
  searchRank: number;
  searchSorts?: string[];
  collectedAt: string;
  sourceMode: CollectionMode;
  isMock: boolean;
  status: CandidateStatus;
  selected: boolean;
  body: string;
  bodyFetched: boolean;
  commentsData: Array<{ id: string; text: string; likes: number | null; author: string }>;
  commentsFetched: boolean;
  accountFetched: boolean;
  statsFetched: boolean;
  requestSignatures: string[];
  classification: {
    track: string;
    secondaryTheme: string;
    tertiaryTheme: string;
    contentType: string;
    contentSubtype?: string;
    contentTypeSource?: ClassificationSource;
    contentSubtypeSource?: ClassificationSource;
    exclusionSuggestion?: "保留" | "建议排除";
    sampleTags: string;
    aiReview?: AiReview;
    semanticSignals?: { barrier: string[]; commercial: string[] };
    lowFollowerViral: "是" | "否" | "待判断";
    lowFollowerRule: string;
    contentAngle: string;
    painPoint: string;
    solution: string;
    practiceEvidence: string;
    hook: string;
    businessSignal: string;
    evidenceLevel: string;
    reviewStatus: string;
    analystNote: string;
  };
  classificationUndo?: {
    field: "contentType" | "contentSubtype";
    value: string;
    source?: ClassificationSource;
    exclusionSuggestion?: "保留" | "建议排除";
    changedAt: string;
  };
};

// 源文件 app/lib/model.ts，第 137 行：ApiAction
export type ApiAction =
  | "xhs_search"
  | "xhs_search_suggestions"
  | "wechat_search_suggestions"
  | "jzl_wechat_industry_rank"
  | "jzl_wechat_account_metrics"
  | "jzl_wechat_principal_info"
  | "jzl_wechat_realtime_followers"
  | "jzl_wechat_search_suggestions"
  | "jzl_wechat_search"
  | "jzl_balance"
  | "jzl_wechat_tietu_history"
  | "jzl_wechat_article_detail"
  | "jzl_wechat_article_metrics"
  | "wxrank_wechat_account_history"
  | "wechat_account_history"
  | "wxrank_balance"
  | "wxrank_wechat_account_search"
  | "wxrank_wechat_article_search"
  | "wxrank_wechat_daily_hot"
  | "wxrank_wechat_article_metrics"
  | "wxrank_wechat_account_basic"
  | "wxrank_wechat_article_data"
  | "wxrank_wechat_comments"
  | "xhs_detail_image"
  | "xhs_detail_video"
  | "xhs_comments"
  | "xhs_comment_replies"
  | "wechat_comment_replies"
  | "xhs_user_info"
  | "xhs_user_notes"
  | "wechat_search"
  | "wechat_detail"
  | "wechat_stats"
  | "wechat_comments";

// 源文件 app/lib/model.ts，第 173 行：CallRecord
export type CallRecord = {
  signature: string;
  action: ApiAction;
  endpoint: string;
  params: Record<string, unknown>;
  status: "成功" | "失败" | "超时待核账" | "模拟";
  estimatedCostUsd: number;
  estimatedCostCny?: number;
  requestId: string;
  cacheUrl: string;
  fetchedAt: string;
  reused: number;
  response?: unknown;
  responseAvailable?: boolean;
  searchCandidateIds?: string[];
  billingSummary?: { remainingBalanceCny: number | null; quotedCostCny: number };
  error?: string;
};

// 源文件 app/lib/model.ts，第 192 行：CallAttempt
export type CallAttempt = {
  id: string;
  ownerId: string;
  signature: string;
  action: ApiAction;
  endpoint: string;
  params: Record<string, unknown>;
  estimatedCostUsd: number;
  estimatedCostCny?: number;
  startedAt: string;
  finishedAt?: string;
  status: "请求中" | "成功" | "失败" | "超时待核账";
  requestId?: string;
  error?: string;
};

// 源文件 app/lib/model.ts，第 403 行：EMPTY_METRICS
export const EMPTY_METRICS: Metrics = {
  views: null,
  reads: null,
  likes: null,
  saves: null,
  comments: null,
  shares: null,
  reposts: null,
};
