# V2｜内容市场研究代码选摘

本目录选自“AI 内容创作系统（V2）”的内容市场研究模块。该模块将人工浏览、筛选和零散记录内容样本的过程集中到工作台，供内容分析与选题研究使用。本包选取 TikHub 小红书搜索 `xhs_search` 及相关处理环节，不包含完整工作台或研究报告。

技术栈为 TypeScript、React、MySQL。原请求代码使用 `json-bigint`，数据库连接使用 `mysql2`；本包不携带生产依赖和配置。

## 文件索引

| 环节 | 文件 | 本包形式 |
| --- | --- | --- |
| 请求参数与预算 | [request-parameters.ts](src/request-parameters.ts)、[paid-policy.ts](src/paid-policy.ts) | 可离线运行的选摘函数 |
| 字段整理与候选合并 | [normalize.ts](src/normalize.ts)、[model.ts](src/model.ts) | 可离线运行；类型定义供这些模块使用 |
| 外部请求与执行锁 | [provider-route.excerpt.ts](src/excerpts/provider-route.excerpt.ts)、[paid-store.excerpt.ts](src/excerpts/paid-store.excerpt.ts) | 静态源码片段 |
| 浏览器保存、内部接口与事务 | [browser-storage.excerpt.ts](src/excerpts/browser-storage.excerpt.ts)、[database-route.excerpt.ts](src/excerpts/database-route.excerpt.ts)、[mysql.excerpt.ts](src/excerpts/mysql.excerpt.ts) | 静态源码片段 |
| 模型复核 | [ai-runtime.excerpt.ts](src/excerpts/ai-runtime.excerpt.ts)、[review-validation.ts](src/review-validation.ts) | 调用代码为静态片段；返回校验可离线运行 |
| 聚合与页面呈现 | [statistics.ts](src/statistics.ts)、[workbench.excerpt.tsx](src/excerpts/workbench.excerpt.tsx) | 基础统计为离线适配；页面为静态片段 |
| 示例与测试 | [输入](examples/synthetic-response.json)、[输出](examples/synthetic-output.json)、[演示入口](examples/offline-demo.mjs)、[测试](tests/offline.test.mjs) | 同一批 5 条合成响应及 10 项测试 |

## 离线运行

使用 Node.js 24，在本目录执行，无需安装依赖：

```powershell
node --test tests/offline.test.mjs
node examples/offline-demo.mjs
```

演示打印规范化后的样本和聚合结果，对应 `synthetic-output.json`。数据与分类均为预设测试值；入口固定采集时间，将 `isMock` 设为 `true`，不发起外部请求、模型调用或数据库写入。

测试覆盖参数与分页、缺失值和零值、身份合并、预算限制、已登记请求匹配、模型返回校验及聚合。严格类型检查仅覆盖 `src` 下 6 个纯函数与类型模块；静态片段不参与编译。

## 选摘与适配

- `src/*.ts` 可独立导入；`src/excerpts/*` 保留原项目函数或局部语句，缺少完整类型、连接器和组件上下文。通用函数保留其他平台分支，演示与测试只覆盖本次选定范围。
- 请求配置只保留 `xhs_search`。规范化省略私有低粉判定调用、阈值说明和公众号主页推导；相关分类保留“待判断”。类型省略未选取的公众号异常值字段及未使用声明。
- `statistics.ts` 仅保留数量、占比和互动中位数；不包含完整评分与推荐逻辑。模型返回校验检查已有字段与允许取值，不是分类准确率评测或完整 JSON Schema 验证。
- 补详情、完整规则初筛、保存队列、AI 标签合并、数据库 DDL、连接配置、完整页面与研究报告未收录。私有 Prompt、价格表、真实响应、账号资料和运行日志也不包含在本包中。
- 数据库片段包含候选增删与事务操作；本包只供阅读，不连接真实数据库。真实采集、模型效果、页面交互和部署均未在本包验证。
