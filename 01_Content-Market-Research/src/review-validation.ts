import { createHash } from "node:crypto";
import type { Candidate } from "./model.ts";

// 仅输入清理、分类枚举和结果校验；未收录私有 Prompt，未接入模型。
// 源文件 app/lib/ai-classification.ts，第 5 行：AI_REVIEW_VERSION
export const AI_REVIEW_VERSION = 2;

// 源文件 app/lib/ai-classification.ts，第 6 行：AI_FORMATS
export const AI_FORMATS = ["待人工判断", "AI科普", "作品／连载", "教程／实践", "案例／复盘", "观点／趋势", "工具／产品测评", "问题／避坑", "建议排除"];

// 源文件 app/lib/ai-classification.ts，第 7 行：AI_DIRECTIONS
export const AI_DIRECTIONS = ["待人工判断", "AI工具", "AI大模型", "AI提示词", "AI Agent", "AI产品", "AI插件", "AI编程", "AI工作流", "AI工作台", "AI内容创作", "AI视频", "AI图文故事", "AI漫剧", "AI真人影像", "AI生图", "AI数字人", "AI音频", "AI电商", "AI知识管理", "企业AI", "FDE", "AI资讯／趋势", "AI充值／账号", "其他AI"];

// 源文件 app/lib/ai-classification.ts，第 8 行：AI_LEVELS
export const AI_LEVELS = ["新手入门", "进阶", "实战", "待人工判断"];

// 源文件 app/lib/ai-classification.ts，第 9 行：AI_AUDIENCES
export const AI_AUDIENCES = ["AI学习", "职场", "教培", "电商", "内容创作者", "开发者", "设计", "企业管理", "营销运营", "科研", "普通消费者", "其他", "待人工判断"];

// 源文件 app/lib/ai-classification.ts，第 10 行：ReviewInput
export type ReviewInput = { id: string; title: string; excerpt: string; body: string };

// 源文件 app/lib/ai-classification.ts，第 11 行：BARRIER_SIGNALS
export const BARRIER_SIGNALS = ["项目交付", "结果数据", "技术流程", "失败限制", "过程材料"];

// 源文件 app/lib/ai-classification.ts，第 12 行：COMMERCIAL_SIGNALS
export const COMMERCIAL_SIGNALS = ["企业任务", "服务交付", "付费产品", "收入转化", "成本效率", "明确需求"];

// 源文件 app/lib/ai-classification.ts，第 13 行：ReviewResult
export type ReviewResult = { id: string; format: string; direction: string; level?: string; audience?: string; barrier: string[]; commercial: string[] };

// 源文件 app/lib/ai-classification.ts，第 14 行：cleanEvidence
export function cleanEvidence(value: unknown) { return (typeof value === "string" ? value : "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").replace(/^接口已返回详情.*$/, "").trim(); }

// 源文件 app/lib/ai-classification.ts，第 15 行：reviewInput
export function reviewInput(candidate: Pick<Candidate, "id" | "title" | "excerpt" | "body">): ReviewInput {
  const body = cleanEvidence(candidate.body);
  return { id: candidate.id, title: cleanEvidence(candidate.title).slice(0, 500), excerpt: cleanEvidence(candidate.excerpt).slice(0, 1500), body: body.length > 6500 ? `${body.slice(0, 4500)} …[中段省略]… ${body.slice(-2000)}` : body };
}

// 源文件 app/lib/ai-classification.ts，第 19 行：inputHash
export function inputHash(value: unknown) { return createHash("sha256").update(JSON.stringify({ version: AI_REVIEW_VERSION, value })).digest("hex"); }

// 源文件 app/lib/ai-classification.ts，第 27 行：validateReviews
export function validateReviews(raw: string, inputs: ReviewInput[], accountNotes = false): ReviewResult[] {
  const parsed = JSON.parse(raw) as { items?: ReviewResult[] };
  const ids = new Set(inputs.map((item) => item.id));
  if (!Array.isArray(parsed.items) || parsed.items.length !== ids.size) throw new Error("AI 返回样本数量不匹配，未写入");
  for (const item of parsed.items) {
    if (!ids.delete(item.id) || !AI_FORMATS.includes(item.format) || !AI_DIRECTIONS.includes(item.direction) || (accountNotes && (!AI_LEVELS.includes(item.level ?? "") || !AI_AUDIENCES.includes(item.audience ?? "")))) throw new Error("AI 返回非法分类或重复身份，未写入");
    if (!Array.isArray(item.barrier) || !Array.isArray(item.commercial) || item.barrier.some((value) => !BARRIER_SIGNALS.includes(value)) || item.commercial.some((value) => !COMMERCIAL_SIGNALS.includes(value))) throw new Error("AI 返回非法语义信号，未写入");
  }
  return parsed.items.map((item) => ({ id: item.id, format: item.format, direction: item.direction, barrier: item.barrier, commercial: item.commercial, ...(accountNotes ? { level: item.level, audience: item.audience } : {}) }));
}
