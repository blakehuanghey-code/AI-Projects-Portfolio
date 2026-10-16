// 配置按原文件摘录；动作表只保留本次选定项，其余依赖仍未打包。
const TIKHUB_API_BASE = "https://api.tikhub.io";
const ACTION_CONFIG = {
  xhs_search: { method: "GET", allowed: ["keyword", "page", "sort_type", "note_type", "time_filter", "search_id", "search_session_id", "source", "ai_mode"], timeoutMs: 30000 }
};

// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 选定动作 xhs_search：GET /api/v1/xiaohongshu/app_v2/search_notes
// 允许字段 keyword/page/sort_type/note_type/time_filter/search_id/search_session_id/source/ai_mode；超时 30000ms。
// 原实现使用 JSONbig.parse 保留大整数；实际配置、价格表、环境凭据、数据库门禁依赖均不打包。

// 源文件 app/api/tikhub/route.ts，第 50 行：cleanParams
const cleanParams = (params: Record<string, unknown>, allowed: string[]) =>
  Object.fromEntries(Object.entries(params).filter(([key, value]) => allowed.includes(key) && value !== undefined && value !== null));

// 源文件 app/api/tikhub/route.ts，第 53 行：findErrorMessage
function findErrorMessage(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(findErrorMessage).filter(Boolean).join("；");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["message_zh", "message", "msg", "detail", "error"]) {
    const message = findErrorMessage(record[key]);
    if (message) return message;
  }
  return "";
}

// 源文件 app/api/tikhub/route.ts，第 134 行：explicitBusinessFailure
function explicitBusinessFailure(payload: unknown, provider: ApiProvider): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const record = payload as Record<string, unknown>;
  if (record.success === false || record.ok === false) return findErrorMessage(payload) || `${provider} 返回业务失败。`;
  const code = record.code ?? record.error_code ?? record.status_code ?? record.statusCode;
  if (code === undefined || code === null || code === "") return "";
  const normalized = String(code).toLowerCase();
  return ["0", "200", "ok", "success"].includes(normalized) ? "" : findErrorMessage(payload) || `${provider} 返回业务错误码 ${String(code)}。`;
}

// 源文件 app/api/tikhub/route.ts，第 160 行：POST
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || request.headers.get("origin") !== url.origin || !request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "只接受本地同源 JSON 请求。" }, { status: 403 });
  try {
    return await executeProviderRequest(await request.json());
  } catch {
    return Response.json({ error: "请求体必须是 JSON。" }, { status: 400 });
  }
}

// 源文件 app/api/tikhub/route.ts，第 171 行：executeProviderRequest
export async function executeProviderRequest(body: PaidRequestInput, dependencies: { claim?: typeof claimPaidRequest; finish?: typeof finishPaidRequest; reject?: typeof rejectUnsentPaidAttempt; request?: typeof fetch } = {}) {
  if (!body || typeof body !== "object" || typeof body.action !== "string" || !body.params || typeof body.params !== "object" || Array.isArray(body.params) || typeof body.signature !== "string" || !body.signature || typeof body.attemptId !== "string" || !body.attemptId) return Response.json({ error: "缺少有效的已落库请求签名、参数或调用尝试 ID。" }, { status: 400 });
  const action = body.action as ApiAction;
  const config = ACTION_CONFIG[action];
  if (!Object.hasOwn(ACTION_CONFIG, action) || !Object.hasOwn(ACTION_ENDPOINTS, action)) return Response.json({ error: "不支持的数据接口操作。" }, { status: 400 });
  const usesJzl = action === "wechat_search_suggestions" || action.startsWith("jzl_");
  const usesWxrank = action.startsWith("wxrank_");
  const provider: ApiProvider = usesWxrank ? "微小榜" : usesJzl ? "极致了" : "TikHub";
  const token = usesWxrank ? process.env.WXRANK_API_KEY : usesJzl ? process.env.JZL_API_KEY : process.env.TIKHUB_API_KEY;
  const priceUsd = usesJzl || usesWxrank ? 0 : actionPriceUsd(action);
  const priceCny = usesWxrank ? WXRANK_ACTION_PRICES_CNY[action] ?? 0 : usesJzl ? jzlActionPriceCny(action, body.params ?? {}) : 0;
  const reject = async (error: string, status: number) => {
    try { await (dependencies.reject ?? rejectUnsentPaidAttempt)(body, error); }
    catch { return Response.json({ error: `${error} 未请求服务商；本地尝试状态未能确认，请先检查数据库。`, notDispatched: true, estimatedCostUsd: 0, estimatedCostCny: 0 }, { status: 503 }); }
    return Response.json({ error, notDispatched: true, estimatedCostUsd: 0, estimatedCostCny: 0 }, { status });
  };
  if (!token) return reject(usesWxrank ? "未配置 WXRANK_API_KEY，不能测试微小榜接口。" : usesJzl ? "未配置 JZL_API_KEY，不能获取公众号下拉词或查询公众号账号指标。" : "未配置 TIKHUB_API_KEY。", 503);
  const params = cleanParams(body.params ?? {}, config.allowed);
  if (Object.keys(params).length !== Object.keys(body.params).length) return reject("请求包含未允许的参数，未请求服务商。", 400);
  let claim: Awaited<ReturnType<typeof claimPaidRequest>>;
  try { claim = await (dependencies.claim ?? claimPaidRequest)({ ...body, params }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "MySQL 付费请求门禁失败，未请求服务商。", notDispatched: true, estimatedCostUsd: 0, estimatedCostCny: 0 }, { status: 409 }); }
  if (claim.cached) {
    const cachedRecord = { ...claim.cached };
    delete cachedRecord.response;
    return Response.json({ ok: true, status: 200, reused: true, action, endpoint: claim.cached.endpoint, estimatedCostUsd: 0, estimatedCostCny: 0, finishedAt: claim.cached.fetchedAt, cachedRecord, upstream: claim.cached.response });
  }
  const endpoint = ACTION_ENDPOINTS[action];
  const url = new URL(endpoint, usesWxrank ? WXRANK_API_BASE : usesJzl ? JZL_API_BASE : TIKHUB_API_BASE);
  if (config.method === "GET") for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const providerParams = action === "wechat_search_suggestions" ? { keyword: params.keyword, BusinessType: 2 } : params;
  if (usesWxrank && config.method === "GET") url.searchParams.set("key", token);
  const requestParams = usesWxrank
    ? { ...providerParams, key: token }
    : usesJzl
      ? { ...providerParams, key: token, verifycode: process.env.JZL_API_VERIFYCODE ?? "" }
      : providerParams;

  const startedAt = new Date().toISOString();
  let upstreamResponseReceived = false;
  let receivedPayload: unknown;
  try {
    const response = await (dependencies.request ?? fetch)(url, {
      method: config.method,
      headers: {
        ...(!usesJzl && !usesWxrank ? { Authorization: `Bearer ${token}` } : {}),
        ...(config.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: config.method === "POST" ? JSON.stringify(requestParams) : undefined,
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    const responseText = await response.text();
    upstreamResponseReceived = true;
    let upstream: unknown;
    try {
      upstream = JSONbig.parse(responseText);
    } catch {
      upstream = { rawText: responseText };
    }
    receivedPayload = upstream;
    const businessFailure = response.ok ? explicitBusinessFailure(upstream, provider) : "";
    const requestSucceeded = response.ok && !businessFailure;
    const finishedAt = new Date().toISOString();
    const upstreamRecord = upstream as Record<string, unknown> | null;
    const billedCost = Number(upstreamRecord?.cost_money ?? upstreamRecord?.cost);
    const remainingBalanceCny = usesWxrank ? wxrankRemainingBalanceCny(upstreamRecord) : Number(upstreamRecord?.remain_money ?? upstreamRecord?.remain);
    const hasPreviousBalance = claim.previousProviderBalanceCny !== null && claim.previousProviderBalanceCny !== undefined;
    const previousBalanceCny = Number(claim.previousProviderBalanceCny);
    const balanceDeltaCny = hasPreviousBalance && Number.isFinite(previousBalanceCny) && Number.isFinite(remainingBalanceCny) && remainingBalanceCny <= previousBalanceCny
      ? Math.max(0, previousBalanceCny - remainingBalanceCny)
      : Number.NaN;
    const recordedCostUsd = requestSucceeded ? priceUsd : 0;
    const usesBalanceBilling = usesJzl || usesWxrank;
    // A provider's list price cannot cap an observed deduction. Missing balance or a top-up
    // keeps the reservation; later billing reconciliation may establish the exact amount.
    const recordedCostCny = action === "jzl_balance" ? 0 : usesBalanceBilling
      ? Number.isFinite(balanceDeltaCny) ? balanceDeltaCny : Math.max(claim.cny, Number.isFinite(billedCost) && billedCost >= 0 ? billedCost : 0)
      : requestSucceeded ? priceCny : 0;
    const record: CallRecord = {
      signature: body.signature, action, endpoint, params, status: requestSucceeded ? "成功" : "失败",
      estimatedCostUsd: recordedCostUsd, estimatedCostCny: recordedCostCny, requestId: String(upstreamRecord?.request_id ?? upstreamRecord?.requestId ?? ""),
      cacheUrl: String(upstreamRecord?.cache_url ?? ""), fetchedAt: finishedAt, reused: 0,
      response: upstream, error: requestSucceeded ? undefined : businessFailure || upstreamErrorMessage(upstream, response.status, action, provider),
    };
    await (dependencies.finish ?? finishPaidRequest)(body.attemptId, record);
    return Response.json({
      ok: requestSucceeded,
      status: response.status,
      error: requestSucceeded ? undefined : businessFailure || upstreamErrorMessage(upstream, response.status, action, provider),
      action,
      endpoint,
      estimatedCostUsd: recordedCostUsd,
      estimatedCostCny: recordedCostCny,
      startedAt,
      finishedAt,
      upstream,
    }, { status: requestSucceeded ? 200 : 502 });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    // A transport failure after dispatch can still be charged, including connection resets.
    const billingUncertain = true;
    const finishedAt = new Date().toISOString();
    const detail = upstreamResponseReceived ? `${provider} 已返回响应，但 MySQL 落盘失败；费用状态按待核账锁定，工作台不会自动重试。` : timedOut ? `请求超时；${provider} 可能已经计费，工作台不会自动重试。` : error instanceof Error ? error.message : "请求失败";
    const recordedCostUsd = claim.usd;
    const recordedCostCny = claim.cny;
    const record: CallRecord = { signature: body.signature, action, endpoint, params, status: billingUncertain ? "超时待核账" : "失败", estimatedCostUsd: recordedCostUsd, estimatedCostCny: recordedCostCny, requestId: "", cacheUrl: "", fetchedAt: finishedAt, reused: 0, error: detail, ...(receivedPayload === undefined ? {} : { response: receivedPayload }) };
    await (dependencies.finish ?? finishPaidRequest)(body.attemptId, record).catch(() => undefined);
    return Response.json({
      error: detail,
      timeoutBillingUncertain: billingUncertain,
      action,
      endpoint,
      estimatedCostUsd: recordedCostUsd,
      estimatedCostCny: recordedCostCny,
      startedAt,
    }, { status: timedOut ? 504 : 502 });
  }
}
