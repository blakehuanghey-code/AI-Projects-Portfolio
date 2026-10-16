// 新增离线验收测试；使用真实选摘函数，所有数据和预算数字均为测试值。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSearchResults, mergeCandidates, extractSearchPagination } from '../src/normalize.ts';
import { searchParams, stableSignature, DEFAULT_SEARCH_FILTERS, ACTION_ENDPOINTS } from '../src/request-parameters.ts';
import { reservePaidBudget, verifyPaidAttempt, paidLockStatus } from '../src/paid-policy.ts';
import { validateReviews, reviewInput } from '../src/review-validation.ts';
import { buildGroupedEntries, candidateInteractionValue, median } from '../src/statistics.ts';
globalThis.fetch=()=>{throw new Error('离线测试禁止网络请求');};
const fixture=JSON.parse(fs.readFileSync(new URL('../examples/synthetic-response.json',import.meta.url),'utf8'));
const context={keywordId:'synthetic-keyword',keyword:'电商 AI 演示',keywordLevel:'二级',track:'合成赛道',secondaryTheme:'合成主题',mode:'平台条件'};
const rows=()=>normalizeSearchResults('小红书',fixture.response,context).map(c=>({...c,isMock:true}));
test('搜索参数保留页码和两类游标；签名不随参数键顺序变化',()=>{
 const p=searchParams('小红书','合成关键词',DEFAULT_SEARCH_FILTERS,{page:2,searchId:'synthetic-search',searchSessionId:'synthetic-session'});
 assert.equal(p.page,2);assert.equal(p.search_id,'synthetic-search');assert.equal(p.search_session_id,'synthetic-session');
 assert.equal(stableSignature('xhs_search',{a:1,b:2}),stableSignature('xhs_search',{b:2,a:1}));
});
test('同一批合成响应映射为五个样本，文本和数值字段正确',()=>{
 const r=rows();assert.equal(r.length,5);assert.equal(r[0].id,'小红书:synthetic-xhs-001');assert.equal(r[0].accountName,'虚构账号1');assert.equal(r[0].metrics.likes,10);assert.equal(r[0].metrics.saves,3);assert.equal(r[0].metricAvailability,'已获取');assert.equal(r[0].classification.lowFollowerViral,'待判断');
});
test('空响应、缺失指标和零指标保持不同含义',()=>{
 assert.deepEqual(normalizeSearchResults('小红书',{},context),[]);
 const r=rows();assert.equal(r[3].metrics.likes,0);assert.equal(r[4].metrics.likes,null);assert.equal(r[4].metricAvailability,'待补齐');assert.equal(candidateInteractionValue(r[3]),0);assert.equal(candidateInteractionValue(r[4]),null);
});
test('重复采集按身份合并，已有正文与人工分类保留',()=>{
 const r=rows();r[0].body='已有正文';r[0].classification.contentType='人工标签';
 const merged=mergeCandidates(r,rows());assert.equal(merged.length,5);const c=merged.find(c=>c.id===r[0].id);assert.equal(c.body,'已有正文');assert.equal(c.classification.contentType,'人工标签');
});
test('分页末页可辨认',()=>{const p=extractSearchPagination('小红书',fixture.response);assert.equal(p.hasMore,false);assert.equal(p.searchSessionId,'synthetic-session');});
const budget={ownerId:'synthetic-job',usd:10,cny:0,allowedActions:['xhs_search'],spentUsd:8,spentCny:0,usedRetries:[]};
test('预算允许范围内预留，超过上限或越范围阻断',()=>{
 assert.equal(reservePaidBudget(budget,'xhs_search',1,0).spentUsd,9);
 assert.throws(()=>reservePaidBudget(budget,'xhs_search',3,0),/预算上限/);
 assert.throws(()=>reservePaidBudget(budget,'wechat_search',1,0),/范围/);
 assert.throws(()=>reservePaidBudget(budget,'xhs_search',NaN,0),/单价/);
});
test('请求必须匹配已登记的尝试，缺失或参数篡改被拒绝',()=>{
 const params={keyword:'合成关键词',page:1};const signature=stableSignature('xhs_search',params);
 const input={action:'xhs_search',params,signature,attemptId:'synthetic-attempt'};
 const attempt={...input,id:input.attemptId,ownerId:'synthetic-job',status:'请求中',endpoint:ACTION_ENDPOINTS.xhs_search};
 assert.doesNotThrow(()=>verifyPaidAttempt(input,attempt));assert.throws(()=>verifyPaidAttempt(input,undefined),/未落库/);assert.throws(()=>verifyPaidAttempt({...input,params:{...params,page:2}},attempt),/不一致/);
 assert.equal(paidLockStatus('超时待核账'),'待核账');
});
const inputs=()=>rows().map(reviewInput);
const result=()=>inputs().map((r,i)=>({id:r.id,format:i<3?'教程／实践':'工具／产品测评',direction:'AI电商',barrier:[],commercial:[]}));
test('模型返回夹具通过身份和分类校验；未运行模型',()=>{assert.equal(validateReviews(JSON.stringify({items:result()}),inputs()).length,5);});
test('模型返回重复身份、遗漏样本或非法分类时不接受',()=>{
 const r=result();r[1].id=r[0].id;assert.throws(()=>validateReviews(JSON.stringify({items:r}),inputs()),/非法分类或重复身份/);
 assert.throws(()=>validateReviews(JSON.stringify({items:result().slice(1)}),inputs()),/数量不匹配/);
 const invalid=result();invalid[0].format='不存在的分类';assert.throws(()=>validateReviews(JSON.stringify({items:invalid}),inputs()),/非法分类/);
});
test('按分类去重聚合数量、占比和互动中位数',()=>{
 const r=rows(), tags=result();const entries=r.map((c,i)=>({key:tags[i].format,candidate:c}));entries.push(entries[0]);
 const grouped=buildGroupedEntries(entries);assert.equal(grouped[0].count,3);assert.equal(grouped[0].share,0.6);assert.equal(grouped[0].medianInteractions,30);assert.equal(grouped[1].medianInteractions,0);
 assert.equal(median(r.map(candidateInteractionValue)),22.5);assert.equal(median([null,undefined,NaN]),null);
});
