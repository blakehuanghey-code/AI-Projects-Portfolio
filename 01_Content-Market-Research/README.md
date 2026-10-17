# V2｜内容市场研究模块

本模块选自“AI 内容创作系统”。它把小红书内容的收集、分类和互动统计放在一个网页工作台中，帮助创作者整理研究资料、比较不同内容方向，为选题提供参考。

本包选取小红书搜索及其后的部分处理代码。可以在本地查看演示数据怎样整理、分类结果怎样检查、统计怎样计算；完整工作台和研究报告未收录。

技术栈为 TypeScript、React、MySQL。原项目使用 `json-bigint` 处理部分接口数据，使用 `mysql2` 连接数据库；本包不携带生产配置；新增模拟联调仅依赖 mysql2，不提供完整生产工程。

## 业务步骤与对应文件

| 业务步骤 | 文件 | 可以查看或验证什么 |
| --- | --- | --- |
| 确认搜索条件，控制调用费用 | [request-parameters.ts](src/request-parameters.ts)、[paid-policy.ts](src/paid-policy.ts) | 参数和预算检查，可在本地运行 |
| 整理字段，合并重复内容 | [normalize.ts](src/normalize.ts)、[model.ts](src/model.ts) | 数据整理规则和统一记录格式，可在本地运行 |
| 请求外部服务，避免重复执行 | [provider-route.excerpt.ts](src/excerpts/provider-route.excerpt.ts)、[paid-store.excerpt.ts](src/excerpts/paid-store.excerpt.ts) | 请求处理和费用记录相关片段，供阅读 |
| 读取和保存资料，防止版本冲突 | [browser-storage.excerpt.ts](src/excerpts/browser-storage.excerpt.ts)、[database-route.excerpt.ts](src/excerpts/database-route.excerpt.ts)、[mysql.excerpt.ts](src/excerpts/mysql.excerpt.ts) | 浏览器、内部接口和数据库之间的处理片段，供阅读 |
| 让 AI 复核分类，并检查返回结果 | [ai-runtime.excerpt.ts](src/excerpts/ai-runtime.excerpt.ts)、[review-validation.ts](src/review-validation.ts) | 模型调用过程供阅读；结果检查可在本地运行 |
| 按分类比较样本数量和互动表现 | [statistics.ts](src/statistics.ts)、[workbench.excerpt.tsx](src/excerpts/workbench.excerpt.tsx) | 基础统计可运行；网页展示部分为代码片段 |
| 对照输入、结果和异常情况 | [输入](examples/synthetic-response.json)、[输出](examples/synthetic-output.json)、[演示入口](examples/offline-demo.mjs)、[测试](tests/offline.test.mjs) | 5 条演示数据及 10 项测试 |

## 在本地查看运行结果

使用 Node.js 24，在本目录执行，无需安装依赖：

```powershell
node --test tests/offline.test.mjs
node examples/offline-demo.mjs
```

第一条运行测试，第二条输出整理后的样本和分类统计，可与 `synthetic-output.json` 对照。数据和分类均提前设定，演示时间固定，没有请求真实服务、调用模型或写入数据库。

测试覆盖搜索条件、分页、缺失值与零值、重复内容合并、预算限制，以及分类结果能否正确对应原样本。严格 TypeScript 类型检查只覆盖 `src` 下 6 个独立模块，代码片段不作为完整工程编译。

## 本包保留和省略了什么

- `src/*.ts` 中的模块可以独立导入；`src/excerpts/*` 是从原项目选取的片段，缺少部分依赖和上下文，供阅读理解，不能直接启动完整应用。
- 请求配置只保留小红书搜索 `xhs_search`。通用函数中的其他平台分支仍保留，但演示和测试只覆盖本次选定范围。
- 内容整理代码省略了私有的低粉账号判断、阈值和公众号主页推导；相关分类保留为“待判断”，未使用的类型字段也已省略。
- 统计只保留数量、占比和互动中位数，没有完整评分和选题推荐规则。分类结果检查关注格式与对应关系，不评估 AI 判断是否准确，也不是完整 JSON Schema 校验。
- 补充详情、完整规则分类、保存队列、AI 标签合并、原系统数据库建表结构、完整网页和研究报告未收录；私有提示词、价格表、真实数据、账号资料和运行日志也未包含。
- 数据库片段涉及新增、修改、删除和事务处理，新增模拟联调使用独立 MySQL 测试库和专用演示表；原系统数据库链路未执行。真实采集、AI 分类效果、页面操作和部署均未在本包验证。

## 新增：可复现的模拟联调

[运行说明](examples/INTEGRATION.md)带读者完成一次本机 Mock HTTP 请求、合成响应整理、MySQL 测试表读写、模拟分类回写和统计。已有纯函数被实际复用；连接各步骤的代码与两张测试表专为展示新建，不补齐原生产接口。

本次实际运行得到 5 条样本、2 次本机 HTTP 往返，并通过分类异常拒绝及事务回滚检查。结果见 [integration-result.json](examples/integration-result.json)。没有调用真实模型、付费接口或原业务数据库。
