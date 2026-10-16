// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 源文件 app/api/database/route.ts，第 12 行：GET
export async function GET(request: Request) {
  try {
    const resource = new URL(request.url).searchParams.get("resource") || "health";
    if (resource === "health") return Response.json(await databaseHealth());
    if (resource === "activity") return Response.json(await databaseActivity());
    if (resource === "state") return Response.json({ ok: true, state: await loadAuthoritativeState() });
    if (resource === "calls") { const params = new URL(request.url).searchParams; return Response.json({ ok: true, records: await loadCallRecords({ omitCommentResponses: params.get("view") === "workbench", summaryOnly: params.get("view") === "summary", signatures: params.has("signature") ? params.getAll("signature") : undefined }) }); }
    if (resource === "attempts") return Response.json({ ok: true, attempts: await loadCallAttempts() });
    return Response.json({ ok: false, error: "未知数据库资源" }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}

// 源文件 app/api/database/route.ts，第 24 行：POST
export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || request.headers.get("origin") !== url.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return Response.json({ ok: false, error: "仅允许本地同源 JSON 操作。" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new StateValidationError("请求正文必须是对象。");
    const operation = String(body.operation ?? "");
    if (operation === "save-state") { validateWorkbenchState(body.state); return Response.json({ ok: true, ...await saveAuthoritativeState(body.state, revision(body.state.revision)) }); }
    else if (operation === "patch-material") { validateMaterialPatch(body.changes); return Response.json({ ok: true, ...await saveMaterials(requiredString(body.id), body.changes, revision(body.revision)) }); }
    else if (operation === "save-calls") await saveCallRecords(records<CallRecord>(body.records, "signature"));
    else if (operation === "save-attempts") await saveCallAttempts(records<CallAttempt>(body.attempts, "id"));
    else if (operation === "begin-attempt") await beginCallAttempt(records<CallAttempt>([body.attempt], "id")[0]);
    else if (operation === "finish-attempt") { if (!body.update || typeof body.update !== "object" || !["成功", "失败", "超时待核账"].includes(String((body.update as CallAttempt).status))) throw new StateValidationError("调用结束状态无效。"); await finishCallAttempt(requiredString(body.id), body.update as Parameters<typeof finishCallAttempt>[1]); }
    else if (operation === "resolve-attempts") { if (!Array.isArray(body.signatures) || !body.signatures.length) throw new StateValidationError("请选择已核对账单的请求。"); await resolveInFlightAttempts(body.signatures.map(requiredString), requiredString(body.reason)); }
    else if (operation === "acquire-lease") { try { validatePaidBudget(body.budget); } catch (error) { throw new StateValidationError(error instanceof Error ? error.message : "采集预算无效。"); } return Response.json({ ok: true, acquired: await acquireLease(requiredString(body.ownerId), ttl(body.ttlMs), body.budget) }); }
    else if (operation === "renew-lease") return Response.json({ ok: true, renewed: await renewLease(requiredString(body.ownerId), ttl(body.ttlMs)) });
    else if (operation === "release-lease") await releaseLease(requiredString(body.ownerId));
    else return Response.json({ ok: false, error: "未知数据库操作" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
