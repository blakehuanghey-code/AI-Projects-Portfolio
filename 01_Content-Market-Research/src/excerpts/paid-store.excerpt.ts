// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 源文件 app/lib/paid-call-store.ts，第 66 行：claimPaidRequest
export async function claimPaidRequest(input: PaidRequestInput, connect: ConnectionFactory = () => pool().getConnection()) {
  const connection = await connect();
  let validatedAttempt: CallAttempt | undefined;
  try {
    await connection.beginTransaction();
    // A single lease row serializes claims across UI, background comments and CLI callers.
    const [leases] = await connection.query<RowDataPacket[]>("SELECT owner_id,expires_at FROM collection_leases WHERE id='collection' FOR UPDATE");
    const [attemptRows] = await connection.query<RowDataPacket[]>("SELECT payload_json FROM call_attempts WHERE id=? FOR UPDATE", [input.attemptId]);
    const attempt = attemptRows.length ? JSON.parse(String(attemptRows[0].payload_json)) as CallAttempt : undefined;
    verifyPaidAttempt(input, attempt);
    validatedAttempt = attempt;
    if (!attempt || leases[0]?.owner_id !== attempt.ownerId || !(Date.parse(String(leases[0]?.expires_at)) > Date.now())) throw new Error("本轮采集执行锁无效，未请求服务商");
    const [budgetRows] = await connection.query<RowDataPacket[]>("SELECT `value` FROM metadata WHERE `key`=? FOR UPDATE", [budgetKey(attempt.ownerId)]);
    if (!budgetRows.length) throw new Error("本轮未确认服务端预算，未请求服务商");
    let budget = JSON.parse(String(budgetRows[0].value)) as PaidBudget;
    validatePaidBudget(budget);
    if (!budget.allowedActions.includes(input.action)) throw new Error("接口不在本轮确认范围内");
    const [receipts] = await connection.query<RowDataPacket[]>("SELECT `value` FROM metadata WHERE `key`=? FOR UPDATE", [receiptKey(input.attemptId)]);
    if (receipts.length) throw new Error("该调用尝试已发送或结果不明，禁止重复发送");
    const [locks] = await connection.query<RowDataPacket[]>("SELECT status,attempt_id FROM pending_billing_locks WHERE signature=? FOR UPDATE", [input.signature]);
    if (locks.some(lock => lock.status === "待核账" || (lock.status === "请求中" && lock.attempt_id !== input.attemptId))) throw new Error("签名存在待核账或其他请求中的锁");
    const [previousAttempts] = await connection.query<RowDataPacket[]>("SELECT id,status FROM call_attempts WHERE signature=? AND id<>? AND status IN ('请求中','超时待核账')", [input.signature, input.attemptId]);
    const [records] = await connection.query<RowDataPacket[]>("SELECT c.*,r.response_json FROM call_records c LEFT JOIN raw_responses r ON r.signature=c.signature WHERE c.signature=? FOR UPDATE", [input.signature]);
    const cached = records.length ? asRecord(records[0]) : undefined;
    let probe = false;
    if (input.forceRefresh && input.action === "wechat_search") {
      const [rows] = await connection.query<RowDataPacket[]>("SELECT JSON_EXTRACT(payload_json,'$.wechatSearchCircuit') AS circuit FROM workspace_state WHERE id=1");
      const circuit = rows[0]?.circuit ? JSON.parse(String(rows[0].circuit)) : null;
      probe = circuit?.status === "open" && Date.parse(circuit.nextProbeAt) <= Date.now();
      if (!probe) throw new Error("尚未到服务端允许的接口恢复探测时间");
    } else if (input.forceRefresh && ["wxrank_balance", "jzl_balance"].includes(input.action)) probe = true; // These actions are explicitly free.
    else if (input.forceRefresh) throw new Error("该动作不允许跳过成功缓存");
    const history = ["wechat_account_history", "wxrank_wechat_account_history", "jzl_wechat_tietu_history"].includes(input.action);
    const cacheFresh = cached?.status === "成功" && cached.response !== undefined && (!history || Date.now() - Date.parse(cached.fetchedAt) < 6 * 60 * 60 * 1000);
    // Completed historical success supersedes stale imported attempts only for a free cache read.
    if (cacheFresh && !probe) {
      const finishedAt = new Date().toISOString();
      const completed = { ...attempt, status: "成功", finishedAt, estimatedCostUsd: 0, estimatedCostCny: 0, error: "复用已成功缓存，未发起付费请求" };
      const payload = JSON.stringify(completed);
      await connection.execute("UPDATE call_attempts SET status='成功',finished_at=?,estimated_cost_usd=0,estimated_cost_cny=0,error=?,payload_json=?,payload_sha256=? WHERE id=?", [finishedAt, completed.error, payload, hash(payload), attempt.id]);
      await connection.execute("UPDATE pending_billing_locks SET status='已解除',resolved_at=? WHERE signature=? AND attempt_id=? AND status='请求中'", [finishedAt, input.signature, input.attemptId]);
      await connection.commit();
      return { cached, usd: 0, cny: 0 };
    }
    if (previousAttempts.length) throw new Error("签名存在结果不明的历史调用尝试");
    if (cached?.status === "超时待核账") throw new Error("签名仍待核账，未请求服务商");
    if (cached?.status === "失败") {
      const maintenanceProbe = probe && /维护|暂时关闭|maintenance|temporarily disabled/i.test(cached.error ?? "");
      const [confirmations] = await connection.query<RowDataPacket[]>("SELECT `value` FROM metadata WHERE `key`=? FOR UPDATE", [billingConfirmationKey(input.signature)]);
      const confirmation = confirmations.length ? JSON.parse(String(confirmations[0].value)) : null;
      const reconciled = confirmation?.signature === input.signature && !confirmation.usedBy && cached.estimatedCostUsd === 0 && (cached.estimatedCostCny ?? 0) === 0;
      if (!maintenanceProbe && !reconciled && !canRetryPaidFailure(cached, budget)) throw new Error("该签名已有失败记录，缺少本轮明确重试授权");
      if (!hasPaidRetryAllowance(budget,input.signature)) throw new Error("同一签名已达到本次明确授权的重试次数");
      if (reconciled) await connection.execute("UPDATE metadata SET `value`=? WHERE `key`=?", [JSON.stringify({ ...confirmation, usedBy: input.attemptId }), billingConfirmationKey(input.signature)]);
      const retryCount=(budget.retryCounts?.[input.signature]??Number(budget.usedRetries.includes(input.signature)))+1;
      budget = { ...budget, usedRetries: [...new Set([...budget.usedRetries, input.signature])], retryCounts:{...budget.retryCounts,[input.signature]:retryCount} };
    }
    const usesJzl = input.action === "wechat_search_suggestions" || input.action.startsWith("jzl_");
    const usd = actionPriceUsd(input.action);
    let cny = WXRANK_ACTION_PRICES_CNY[input.action] ?? (usesJzl ? jzlActionPriceCny(input.action, input.params) : 0);
    if (usesJzl && input.action !== "jzl_balance") {
      const [prices] = await connection.query<RowDataPacket[]>("SELECT MAX(estimated_cost_cny) AS price FROM call_records WHERE action=? AND status='成功'", [input.action]);
      cny = Math.max(cny, Number(prices[0]?.price ?? 0));
      if (!(cny > 0)) throw new Error("此人民币接口尚无可验证单价，需先单独确认校准方案");
    }
    budget = reservePaidBudget(budget, input.action, usd, cny);
    const receipt: Receipt = { ownerId: attempt.ownerId, status: "请求中", usd, cny };
    await connection.execute("UPDATE metadata SET `value`=? WHERE `key`=?", [JSON.stringify(budget), budgetKey(attempt.ownerId)]);
    await connection.execute("INSERT INTO metadata(`key`,`value`) VALUES (?,?)", [receiptKey(input.attemptId), JSON.stringify(receipt)]);
    // Previous balance comes only from persisted provider responses, never from the browser.
    const usesWxrank = input.action.startsWith("wxrank_");
    let previousProviderBalanceCny: number | null = null;
    if (usesJzl || usesWxrank) {
      const actions = usesWxrank ? "c.action LIKE 'wxrank\\_%'" : "(c.action LIKE 'jzl\\_%' OR c.action='wechat_search_suggestions')";
      const [balanceRows] = await connection.query<RowDataPacket[]>(`SELECT r.response_json FROM call_records c JOIN raw_responses r ON r.signature=c.signature WHERE ${actions} AND c.status='成功' ORDER BY c.fetched_at DESC LIMIT 30`);
      for (const row of balanceRows) {
        const response = JSON.parse(String(row.response_json));
        const match = String(response?.msg ?? response?.message ?? "").match(/剩余\s*(\d+(?:\.\d+)?)\s*积分/);
        const raw = usesWxrank ? (match ? Number(match[1]) / 100 : null) : response?.remain_money ?? response?.remain;
        if (raw !== null && raw !== undefined && Number.isFinite(Number(raw))) { previousProviderBalanceCny = Number(raw); break; }
      }
    }
    await connection.commit();
    return { cached: undefined, usd, cny, previousProviderBalanceCny };
  } catch (error) {
    await connection.rollback();
    if (validatedAttempt) {
      // A rejected preflight has certainly not dispatched. Do not leave a false in-flight lock.
      await rejectUnsentOnConnection(connection, input, error instanceof Error ? error.message : "未发送").catch(() => undefined);
    }
    throw error;
  } finally { connection.release(); }
}
