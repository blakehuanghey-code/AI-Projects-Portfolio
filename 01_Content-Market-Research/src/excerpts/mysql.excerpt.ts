// 静态源码选摘，不是可独立运行模块。未收录的类型、连接器和依赖见 README。
// 请勿把此文件接入生产服务；本展示包的离线测试不会导入本文件。

// 源文件 app/lib/mysql.ts，第 41 行：loadAuthoritativeState
export async function loadAuthoritativeState(): Promise<WorkbenchState | null> {
  const [rows] = await pool().query<RowDataPacket[]>("SELECT payload_json FROM workspace_state WHERE id=1");
  if (!rows.length) return null;
  const state = JSON.parse(String(rows[0].payload_json)) as WorkbenchState;
  return { ...state, revision: stateRevision(state) };
}

// 源文件 app/lib/mysql.ts，第 48 行：syncCandidates
async function syncCandidates(connection: PoolConnection, state: WorkbenchState) {
  const [existingRows] = await connection.query<RowDataPacket[]>("SELECT id,payload_json,payload_sha256 FROM candidates");
  const existing = new Map(existingRows.map((row) => [String(row.id), { payload: String(row.payload_json), hash: String(row.payload_sha256) }]));
  const currentIds = new Set(state.candidates.map((candidate) => String(candidate.id)));
  for (const candidate of state.candidates) {
    const payload = json(candidate); const hash = sha256(payload); const previous = existing.get(String(candidate.id));
    if (previous?.hash === hash) continue;
    const metrics = candidate.metrics ?? {}; const classification = candidate.classification;
    await connection.execute(
      `INSERT INTO candidates(id,platform,platform_item_id,item_type,keyword_id,keyword,keyword_level,track,secondary_theme,title,excerpt,body,published_at,url,account_id,account_name,account_note_count,followers,account_registered_at,views,\`reads\`,likes,saves,comments,shares,reposts,content_type,content_direction,review_status,exclusion_suggestion,collected_at,source_mode,status,is_mock,payload_json,payload_sha256)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE platform=VALUES(platform),platform_item_id=VALUES(platform_item_id),item_type=VALUES(item_type),keyword_id=VALUES(keyword_id),keyword=VALUES(keyword),keyword_level=VALUES(keyword_level),track=VALUES(track),secondary_theme=VALUES(secondary_theme),title=VALUES(title),excerpt=VALUES(excerpt),body=VALUES(body),published_at=VALUES(published_at),url=VALUES(url),account_id=VALUES(account_id),account_name=VALUES(account_name),account_note_count=VALUES(account_note_count),followers=VALUES(followers),account_registered_at=VALUES(account_registered_at),views=VALUES(views),\`reads\`=VALUES(\`reads\`),likes=VALUES(likes),saves=VALUES(saves),comments=VALUES(comments),shares=VALUES(shares),reposts=VALUES(reposts),content_type=VALUES(content_type),content_direction=VALUES(content_direction),review_status=VALUES(review_status),exclusion_suggestion=VALUES(exclusion_suggestion),collected_at=VALUES(collected_at),source_mode=VALUES(source_mode),status=VALUES(status),is_mock=VALUES(is_mock),payload_json=VALUES(payload_json),payload_sha256=VALUES(payload_sha256)`,
      [candidate.id, candidate.platform, candidate.platformItemId || null, candidate.itemType || null, candidate.keywordId || null, candidate.keyword || null, candidate.keywordLevel || null, candidate.track || null, candidate.secondaryTheme || null, candidate.title || null, candidate.excerpt || null, candidate.body || null, candidate.publishedAt || null, candidate.url || null, candidate.accountId || null, candidate.accountName || null, integer(candidate.accountNoteCount), integer(candidate.followers), candidate.accountRegisteredAt || null, integer(metrics.views), integer(metrics.reads), integer(metrics.likes), integer(metrics.saves), integer(metrics.comments), integer(metrics.shares), integer(metrics.reposts), classification.contentType || null, classification.contentSubtype || null, classification.reviewStatus || null, classification.exclusionSuggestion || null, candidate.collectedAt || null, candidate.sourceMode || null, candidate.status || null, candidate.isMock ? 1 : 0, payload, hash],
    );
    await connection.execute("DELETE FROM candidate_search_queries WHERE candidate_id=?", [candidate.id]);
    await connection.execute("DELETE FROM candidate_request_signatures WHERE candidate_id=?", [candidate.id]);
    for (const query of candidate.searchQueries ?? []) if (query) await connection.execute("INSERT INTO candidate_search_queries(candidate_id,search_query) VALUES (?,?)", [candidate.id, query]);
    for (const signature of candidate.requestSignatures ?? []) if (signature) await connection.execute("INSERT IGNORE INTO candidate_request_signatures(candidate_id,signature) VALUES (?,?)", [candidate.id, signature]);
    const before = previous ? json((JSON.parse(previous.payload) as { classification?: unknown }).classification ?? null) : null;
    const after = json(classification);
    if (before !== after) await connection.execute("INSERT INTO classification_revisions(candidate_id,changed_at,source,before_json,after_json,after_sha256) VALUES (?,?,?,?,?,?)", [candidate.id, new Date().toISOString(), previous ? "工作台修改" : "主源迁移", before, after, sha256(after)]);
  }
  for (const id of existing.keys()) if (!currentIds.has(id)) await connection.execute("DELETE FROM candidates WHERE id=?", [id]);
}

// 源文件 app/lib/mysql.ts，第 112 行：saveAuthoritativeState
export async function saveAuthoritativeState(input: WorkbenchState | ((latest: WorkbenchState) => WorkbenchState), expectedRevision?: number) {
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<RowDataPacket[]>("SELECT payload_json FROM workspace_state WHERE id=1 FOR UPDATE");
    const latest = rows.length ? JSON.parse(String(rows[0].payload_json)) as WorkbenchState : null;
    if (expectedRevision !== undefined) assertRevision(expectedRevision, latest);
    if (typeof input === "function" && !latest) throw new Error("MySQL 中没有工作台状态");
    const merged = typeof input === "function" ? input(latest!) : latest ? mergeReviewedState(input, latest) : input;
    merged.candidates = merged.candidates.map(removeRetiredMarketFields);
    // Server-only semantic patches merge under the lock and do not invalidate a browser's business revision.
    const revision = stateRevision(latest) + (typeof input !== "function" || expectedRevision !== undefined ? 1 : 0);
    const state: WorkbenchState = { ...merged, revision, materials: syncMaterialClassifications(merged.materials ?? [], merged.candidates, new Date().toISOString()).materials, calls: merged.calls.map((record) => { const copy = { ...record }; delete copy.response; return copy; }) };
    const payload = json(state);
    await connection.execute("INSERT INTO workspace_state(id,payload_json,payload_sha256) VALUES (1,?,?) ON DUPLICATE KEY UPDATE payload_json=VALUES(payload_json),payload_sha256=VALUES(payload_sha256)", [payload, sha256(payload)]);
    await syncCandidates(connection, state); await syncSections(connection, state, latest);
    // AI patches only change classifications, account notes and intents, not collection membership.
    if (typeof input !== "function") { await syncSimpleRecords(connection, "collection_jobs", state.jobs ?? []); await syncSimpleRecords(connection, "collection_runs", state.collectionRuns ?? []); await syncSimpleRecords(connection, "observations", state.observations ?? []); await syncMemberships(connection, state, latest); }
    await connection.execute("INSERT INTO metadata(`key`,`value`) VALUES ('primary_source_last_saved_at',?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)", [new Date().toISOString()]);
    await connection.commit();
    return { revision };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
