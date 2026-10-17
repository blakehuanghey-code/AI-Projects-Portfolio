-- 专为本展示新建的两张测试表，不是原系统表结构或迁移脚本。
CREATE DATABASE IF NOT EXISTS portfolio_mock_demo CHARACTER SET utf8mb4;
USE portfolio_mock_demo;
CREATE TABLE IF NOT EXISTS demo_requests (
  run_id CHAR(36) PRIMARY KEY,
  payload JSON NOT NULL
);
CREATE TABLE IF NOT EXISTS demo_samples (
  run_id CHAR(36) NOT NULL,
  sample_id VARCHAR(200) NOT NULL,
  payload JSON NOT NULL,
  review JSON NULL,
  PRIMARY KEY (run_id, sample_id)
);
