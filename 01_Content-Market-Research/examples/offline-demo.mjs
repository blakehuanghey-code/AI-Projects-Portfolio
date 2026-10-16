// 新增展示适配；不调用外部服务，不写数据库。
import fs from 'node:fs';
import { normalizeSearchResults } from '../src/normalize.ts';
import { validateReviews } from '../src/review-validation.ts';
import { buildGroupedEntries } from '../src/statistics.ts';
globalThis.fetch = () => { throw new Error('离线示例禁止网络请求'); };
const fixture=JSON.parse(fs.readFileSync(new URL('./synthetic-response.json',import.meta.url),'utf8'));
const context={keywordId:'synthetic-keyword',keyword:'电商 AI 演示',keywordLevel:'二级',track:'合成赛道',secondaryTheme:'合成主题',mode:'平台条件'};
// 原规范化函数面向真实采集，默认 isMock=false；演示适配强制覆盖并固定时间。
export const candidates=normalizeSearchResults('小红书',fixture.response,context).map(c=>({...c,isMock:true,collectedAt:'2026-01-01T00:00:00.000Z'}));
// 分类为预设测试值，用于验证返回结构；本次未调用模型。
const mockItems=candidates.map((c,i)=>({id:c.id,format:i<3?'教程／实践':'工具／产品测评',direction:'AI电商',barrier:[],commercial:[]}));
const reviews=validateReviews(JSON.stringify({items:mockItems}),candidates);
const entries=candidates.map(c=>({key:reviews.find(r=>r.id===c.id).format,candidate:c}));
console.log(JSON.stringify({synthetic:true,modelCalled:false,databaseConnected:false,candidates,statistics:buildGroupedEntries(entries)},null,2));
