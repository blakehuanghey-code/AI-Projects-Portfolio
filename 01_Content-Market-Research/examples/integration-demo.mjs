// 独立模拟演示胶水代码；不是原系统的服务、表结构或模型运行器。
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { searchParams, stableSignature, DEFAULT_SEARCH_FILTERS, ACTION_ENDPOINTS } from '../src/request-parameters.ts';
import { verifyPaidAttempt, reservePaidBudget } from '../src/paid-policy.ts';
import { normalizeSearchResults, mergeCandidates } from '../src/normalize.ts';
import { validateReviews } from '../src/review-validation.ts';
import { buildGroupedEntries } from '../src/statistics.ts';

const port = Number(process.env.PORTFOLIO_DEMO_DB_PORT);
const password = process.env.PORTFOLIO_DEMO_DB_PASSWORD;
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 3306 || !password) {
  throw new Error('请设置隔离测试库端口（非 3306）与演示账号密码；不读取原系统配置');
}
const fixture = JSON.parse(fs.readFileSync(new URL('./synthetic-response.json', import.meta.url), 'utf8'));
const runId = randomUUID();
const context = { keywordId:'synthetic-keyword', keyword:'电商 AI 演示', keywordLevel:'二级', track:'合成赛道', secondaryTheme:'合成主题', mode:'平台条件' };
const params = searchParams('小红书', context.keyword, DEFAULT_SEARCH_FILTERS);
const signature = stableSignature('xhs_search', params);
const attempt = { id:runId, ownerId:runId, action:'xhs_search', params, signature, status:'请求中', endpoint:ACTION_ENDPOINTS.xhs_search };
const trace = [];
let httpRequests = 0;
// 两个接口都只返回固定的合成夹具，不转发任意 URL，不加载真实凭据。
const server = http.createServer(async (req, res) => {
  httpRequests++;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString());
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'POST' && req.url === '/mock/search') {
      assert.deepEqual(input, params);
      res.end(JSON.stringify(fixture.response));
    } else if (req.method === 'POST' && req.url === '/mock/classify') {
      assert.equal(input.ids.length, 5);
      res.end(JSON.stringify({ items:input.ids.map((id,i) => ({ id, format:i<3?'教程／实践':'工具／产品测评', direction:'AI电商', barrier:[], commercial:[] })) }));
    } else { res.statusCode=404; res.end(JSON.stringify({ error:'只支持固定演示路由' })); }
  } catch { res.statusCode=400; res.end(JSON.stringify({ error:'模拟请求不符合固定演示输入' })); }
});
let db;
try {
  db = await mysql.createConnection({ host:'127.0.0.1', port, user:'portfolio_demo', password, database:'portfolio_mock_demo', connectTimeout:5000 });
  const [[identity]] = await db.query('SELECT DATABASE() AS name, CURRENT_USER() AS account');
  assert.equal(identity.name, 'portfolio_mock_demo');
  assert.equal(identity.account.split('@')[0], 'portfolio_demo');
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (route,body) => {
    const response = await fetch(base+route, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), redirect:'error', signal:AbortSignal.timeout(5000) });
    assert.equal(response.status,200);
    return response.json();
  };
  await db.execute('INSERT INTO demo_requests (run_id, payload) VALUES (?, ?)', [runId,JSON.stringify(attempt)]);
  const [[storedAttempt]] = await db.execute('SELECT payload FROM demo_requests WHERE run_id=?', [runId]);
  verifyPaidAttempt({ ...attempt, attemptId:runId }, storedAttempt.payload);
  reservePaidBudget({ ownerId:runId, usd:0, cny:0, allowedActions:['xhs_search'], spentUsd:0, spentCny:0, usedRetries:[] }, 'xhs_search', 0, 0);
  trace.push({ step:'请求准备', result:'模拟尝试已写入测试表，参数与零费用预算校验通过' });
  const response = await post('/mock/search', params);
  const normalized = normalizeSearchResults('小红书',response,context).map(c => ({...c,isMock:true,collectedAt:'2026-01-01T00:00:00.000Z'}));
  const candidates = mergeCandidates(normalized,normalized);
  assert.equal(candidates.length,5);
  trace.push({ step:'模拟接口与整理', result:'真实本机 HTTP 往返；合成响应解析、规范化与去重得到 5 条记录' });
  await db.beginTransaction();
  try {
    for (const c of candidates) await db.execute('INSERT INTO demo_samples (run_id, sample_id, payload) VALUES (?, ?, ?)', [runId,c.id,JSON.stringify(c)]);
    await db.commit();
  } catch (error) { await db.rollback(); throw error; }
  const [saved] = await db.execute('SELECT payload FROM demo_samples WHERE run_id=? ORDER BY sample_id', [runId]);
  const fromDatabase = saved.map(x => x.payload);
  // JSON 不保留 undefined；按实际序列化内容核对回读值。
  assert.deepEqual(fromDatabase,JSON.parse(JSON.stringify(candidates.toSorted((a,b)=>a.id.localeCompare(b.id)))));
  trace.push({ step:'MySQL 保存与读取', result:'独立测试表事务保存 5 条合成记录，回读与输入逐项一致' });
  const mockResult = await post('/mock/classify', { ids:fromDatabase.map(c=>c.id) });
  const reviews = validateReviews(JSON.stringify(mockResult),fromDatabase);
  await db.beginTransaction();
  try {
    for (const review of reviews) await db.execute('UPDATE demo_samples SET review=? WHERE run_id=? AND sample_id=?', [JSON.stringify(review),runId,review.id]);
    await db.commit();
  } catch (error) { await db.rollback(); throw error; }
  const [reviewed] = await db.execute('SELECT payload, review FROM demo_samples WHERE run_id=? ORDER BY sample_id', [runId]);
  const statistics = buildGroupedEntries(reviewed.map(x => ({ key:x.review.format,candidate:x.payload })));
  assert.equal(statistics[0].count,3); assert.equal(statistics[0].medianInteractions,30);
  assert.equal(statistics[1].count,2); assert.equal(statistics[1].medianInteractions,0);
  trace.push({ step:'模拟分类与统计', result:'预设分类经原校验函数检查、写入测试表后读取并统计；没有调用模型' });
  const invalid = structuredClone(mockResult); invalid.items[1].id=invalid.items[0].id;
  assert.throws(()=>validateReviews(JSON.stringify(invalid),fromDatabase), /重复身份/);
  const [afterRejected] = await db.execute('SELECT payload, review FROM demo_samples WHERE run_id=? ORDER BY sample_id', [runId]);
  assert.deepEqual(afterRejected,reviewed);
  trace.push({ step:'异常返回保护', result:'重复分类身份被拒绝，已保存的有效结果不变' });
  const rollbackRun = randomUUID();
  await db.beginTransaction();
  try {
    const args=[rollbackRun,'rollback-sample',JSON.stringify({synthetic:true})];
    await db.execute('INSERT INTO demo_samples (run_id, sample_id, payload) VALUES (?, ?, ?)',args);
    await assert.rejects(db.execute('INSERT INTO demo_samples (run_id, sample_id, payload) VALUES (?, ?, ?)',args),error=>error.code==='ER_DUP_ENTRY');
  } finally { await db.rollback(); }
  const [[rolledBack]] = await db.execute('SELECT COUNT(*) AS count FROM demo_samples WHERE run_id=?',[rollbackRun]);
  assert.equal(rolledBack.count,0);
  trace.push({ step:'事务回滚', result:'测试插入发生主键冲突后回滚，失败事务没有残留记录' });
  console.log(JSON.stringify({ synthetic:true, mockApi:true, mysqlExecuted:true, originalDatabaseUsed:false, modelCalled:false, paidApiCalled:false, httpRequests, sampleCount:5, trace, statistics },null,2));
} finally {
  if (server.listening) await new Promise(resolve=>server.close(resolve));
  if (db) await db.end();
}
