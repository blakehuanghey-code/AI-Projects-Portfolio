# 运行一次模拟联调

此演示串联请求准备、本机 Mock API、合成响应解析、规范化去重、MySQL 测试表读写、模拟分类回写和统计。读者能复现这个固定演示，不能据此启动原业务系统。

## 准备独立测试环境

使用 Node.js 24 和独立 MySQL 8.4 测试实例。本次验证使用 MySQL 8.4.11，绑定 127.0.0.1，端口 33079；不连接现有生产实例，不复用原系统的配置或凭据。

在这个独立实例中，用管理员导入 [integration-schema.sql](integration-schema.sql)。它只创建 portfolio_mock_demo 数据库和两张演示表，与原系统表结构无关。再创建专用演示账号，例如：

```sql
CREATE USER 'portfolio_demo'@'127.0.0.1' IDENTIFIED BY '<自行设置的测试密码>';
GRANT SELECT, INSERT, UPDATE ON portfolio_mock_demo.* TO 'portfolio_demo'@'127.0.0.1';
```

密码占位符须替换，不能原样使用；不授予原业务数据库权限。创建数据库和账号只在自己准备的隔离测试实例操作。

## 安装并执行

在本模块目录执行。npm ci 只安装锁文件中的公开依赖；后续运行只连接本机。

```powershell
npm ci --ignore-scripts
$env:PORTFOLIO_DEMO_DB_PORT = '33079'
$demoCredential = Get-Credential -UserName portfolio_demo -Message '输入隔离测试库的演示账号密码'
$env:PORTFOLIO_DEMO_DB_PASSWORD = $demoCredential.GetNetworkCredential().Password
try {
    npm run demo:integration
} finally {
    Remove-Item Env:PORTFOLIO_DEMO_DB_PASSWORD -ErrorAction SilentlyContinue
    $demoCredential = $null
}
```

演示固定连接 127.0.0.1、portfolio_mock_demo 与 portfolio_demo，拒绝默认端口 3306。实际端口请按隔离实例设置。端口和库名限制不能代替隔离环境，运行前仍需自己确认实例用途。

## 如何判断成功

输出与 [integration-result.json](integration-result.json)对应：2 次本机 HTTP 往返、5 条样本；教程类 3 条，互动中位数 30；工具类 2 条，互动中位数 0。mysqlExecuted 为 true，modelCalled、paidApiCalled 和 originalDatabaseUsed 为 false。最后两步验证重复分类身份被拒绝、失败事务回滚后无残留。

每次运行使用独立 run_id，已有测试记录保留；脚本结束关闭连接和 Mock 服务，不停止由你管理的 MySQL 实例。未使用真实采集、原生产路由、原表结构、原提示词或真实 AI 分类。
