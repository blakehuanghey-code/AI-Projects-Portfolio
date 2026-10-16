import type { ApiAction, CallAttempt } from "./model.ts";
import { ACTION_ENDPOINTS, stableSignature } from "./request-parameters.ts";

// 源文件 app/lib/paid-call-policy.ts，第 4 行：PaidBudgetInput
export type PaidBudgetInput = {
  usd: number | null;
  cny: number | null;
  allowedActions: ApiAction[];
  authorizedRetries?: string[];
};

// 源文件 app/lib/paid-call-policy.ts，第 10 行：PaidBudget
export type PaidBudget = PaidBudgetInput & { ownerId: string; spentUsd: number; spentCny: number; usedRetries: string[]; retryLimits?: Record<string, number>; retryCounts?: Record<string, number>; retryGrants?: Array<{id:string;reason:string;at:string;signatures:string[];attempts:number}> };

// 源文件 app/lib/paid-call-policy.ts，第 11 行：PaidRequestInput
export type PaidRequestInput = { action: ApiAction; params: Record<string, unknown>; signature: string; attemptId: string; forceRefresh?: boolean };

// 源文件 app/lib/paid-call-policy.ts，第 21 行：verifyPaidAttempt
export function verifyPaidAttempt(input: PaidRequestInput, attempt: CallAttempt | undefined) {
  if (!attempt || attempt.id !== input.attemptId || attempt.status !== "请求中" || !attempt.ownerId) throw new Error("请求尝试未落库、已完成或缺少所属任务，未请求服务商");
  if (attempt.action !== input.action || attempt.signature !== input.signature || stableSignature(input.action, input.params) !== input.signature || stableSignature(attempt.action, attempt.params) !== input.signature || attempt.endpoint !== ACTION_ENDPOINTS[input.action]) throw new Error("请求与已落库尝试的动作、参数或签名不一致");
}

// 源文件 app/lib/paid-call-policy.ts，第 45 行：reservePaidBudget
export function reservePaidBudget(budget: PaidBudget, action: ApiAction, usd: number, cny: number): PaidBudget {
  if (!budget.allowedActions.includes(action)) throw new Error("该接口不在本轮已确认范围内");
  if (![usd, cny].every(n => Number.isFinite(n) && n >= 0)) throw new Error("缺少可验证的接口单价，未请求服务商");
  const spentUsd = Math.round((budget.spentUsd + usd) * 1e8) / 1e8;
  const spentCny = Math.round((budget.spentCny + cny) * 1e8) / 1e8;
  if ((budget.usd !== null && spentUsd > budget.usd + 1e-9) || (budget.cny !== null && spentCny > budget.cny + 1e-9)) throw new Error("达到本轮服务端预算上限，未请求服务商");
  return { ...budget, spentUsd, spentCny };
}

// 源文件 app/lib/paid-call-policy.ts，第 54 行：paidLockStatus
export function paidLockStatus(status: CallAttempt["status"]) {
  return status === "请求中" ? "请求中" : status === "超时待核账" ? "待核账" : "已解除";
}
