import type { Candidate } from "./model.ts";

// 展示适配：分组函数只保留数量、占比、互动中位数；不输出商业评分或推荐。
// 源文件 app/lib/market-analysis.ts，第 79 行：candidateInteractionValue
export function candidateInteractionValue(candidate: Candidate) {
  const values = candidate.platform === "公众号"
    ? [candidate.metrics.likes, candidate.metrics.comments, candidate.metrics.shares ?? candidate.metrics.reposts]
    : [candidate.metrics.likes, candidate.metrics.saves, candidate.metrics.comments];
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}

// 源文件 app/lib/market-analysis.ts，第 72 行：median
export const median = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value)).sort((left, right) => left - right);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
};

// 源文件 app/lib/market-analysis.ts，第 146 行：buildGroupedEntries
export function buildGroupedEntries(entries: Array<{ key: string; candidate: Candidate }>) {
  const grouped = new Map<string, Candidate[]>();
  for (const { key, candidate } of entries) {
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    if (!current.some((item) => item.id === candidate.id)) current.push(candidate);
    grouped.set(key, current);
  }
  const totalMemberships = [...grouped.values()].reduce((sum, rows) => sum + rows.length, 0);
  const base = [...grouped.entries()].map(([contentType, rows]) => {
    const platform = rows.length && rows.every((candidate) => candidate.platform === rows[0].platform) ? rows[0].platform : null;
    const interactions = rows.map(candidateInteractionValue);
    return {
      contentType,
      platform,
      count: rows.length,
      share: totalMemberships ? rows.length / totalMemberships : 0,
      medianInteractions: median(interactions),
    };
  });

  return base;
}
