# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **WebSocket 实时事件推送**
  - `new_transaction` 事件：交易创建时广播
  - `new_block` 事件：新区块挖出时广播
  - `chain_update` 事件：链状态更新时广播
  - 自动重连机制
  - 前端页面集成实时更新
- WebSocket 测试脚本：`test-websocket.js`
- WebSocket API 文档（README.md）
- 依赖升级到最新版本：
  - express 4.22.1 → 5.2.1
  - ws 8.19.0

### Changed
- 前端界面自动连接 WebSocket，实时刷新链状态
- package.json 依赖版本锁定

### Fixed
- 无

### Security
- 无

## [1.0.0] - 2026-03-14

### Added
- 初始版本发布
- 核心区块链功能（区块、交易、加密）
- REST API（9个端点）
- 前端浏览器界面
- Docker 支持
- 难度自动调整
- 出块奖励机制
