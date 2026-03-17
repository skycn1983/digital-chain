# DAO 投票 DApp

基于 Digital Chain 的去中心化自治组织（DAO）投票应用，展示链上治理功能。

## ⚠️ 当前版本说明

**版本**: 1.0.0-demo

本 DApp 演示了 DAO 投票的完整 UI/UX 流程。当前节点版本 **尚未内置** 提案和投票的特殊交易处理，因此：

- ✅ 钱包创建、余额查询、挖矿 → 使用现有 API，完全正常
- ✅ 提案创建、投票交互 → 存储在浏览器 localStorage（模拟）
- ⏳ 链上持久化 → 需要节点扩展支持 `metadata` 字段

后续可通过升级节点实现完整链上治理。

## 功能

- ✅ 创建钱包 / 导入钱包
- ✅ 创建治理提案
- ✅ 投票（支持/反对/弃权）
- ✅ 实时投票统计（进度条）
- ✅ WebSocket 实时更新
- ✅ 提案历史查看

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript
- **数据**: 浏览器 localStorage（模拟链上存储）
- **通信**: REST API + WebSocket

## 快速开始

### 1. 启动节点

```bash
cd /path/to/digital-chain
node src/server.js
```

节点应运行在 `http://localhost:3000`。

### 2. 启动 DApp

```bash
cd examples/voting-dapp
npx http-server -p 8081 -o
```

访问 http://localhost:8081

### 3. 演示流程

1. **创建钱包** - 点击"创建新钱包"
2. **获取投票权** - 挖矿获得 OCT 代币（余额代表投票权重，当前版本票数不按代币加权）
3. **创建提案** - 输入标题、描述、投票时长（区块数）
4. **投票** - 点击提案卡片，选择投票选项
5. **查看结果** - 实时统计支持/反对/弃权比例

## 提案数据结构

提案存储在 localStorage，格式：

```javascript
{
  id: "交易哈希",           // 提案创建交易的 hash
  title: "提案标题",
  description: "详细描述...",
  creator: "0x...",
  startBlock: 100,          // 开始区块高度
  endBlock: 200,            // 结束区块高度
  votes: {
    yes: 0,
    no: 0,
    abstain: 0
  },
  voters: {
    "0x voter1": "yes",
    "0x voter2": "no"
  },
  timestamp: 1234567890
}
```

## 技术架构

### 文件结构

```
voting-dapp/
├── index.html          # 主界面
├── css/
│   └── style.css      # 投票应用样式
├── js/
│   └── app.js         # 提案管理、投票逻辑、链上扫描
├── package.json       # 项目配置
└── README.md          # 本文档
```

### 核心模块

| 模块 | 说明 |
|------|------|
| `index.html` | 钱包面板、提案创建表单、提案列表、投票面板 |
| `js/app.js` | 提案扫描（模拟链上）、投票提交、WebSocket 实时更新 |
| `css/style.css` | 投票卡片、进度条、状态指示器 |

### API 依赖

| 端点 | 用途 |
|------|------|
| `POST /wallet/create` | 创建钱包 |
| `GET /balance/:address` | 查询投票权（余额） |
| `GET /chain` | 扫描提案（当前模拟） |
| `POST /transaction` | 提交提案/投票交易（需要节点扩展） |
| `WS /ws` | 实时更新 |

## 故障排除

| 问题 | 可能原因 | 解决 |
|------|----------|------|
| 提案列表为空 | 未创建提案或 localStorage 清空 | 创建新提案，或检查浏览器存储 |
| 投票失败 | 未创建钱包或已投过票 | 确保登录且未投过 |
| WebSocket 断开 | 节点未运行 | 启动节点 `node src/server.js` |
| 数据不同步 | 多个浏览器标签页 | 仅在一个标签页打开，或实现跨标签同步 |

### 清除模拟数据

```javascript
// 浏览器控制台
localStorage.clear();
location.reload();
```

## 扩展为链上治理

当前版本使用 localStorage 模拟提案存储。要迁移到真实链上数据，需要：

### 1. 节点扩展（服务端）

修改 `src/blockchain.js` 或添加智能合约层，支持：

**提案创建交易**：
```javascript
{
  from: "0xcreator",
  to: "0x0000000000000000000000000000000000000001", // 提案注册地址
  amount: 0,
  data: JSON.stringify({
    type: "proposal",
    title: "...",
    description: "...",
    endBlock: 150
  })
}
```

**投票交易**：
```javascript
{
  from: "0xvoter",
  to: "0x0000000000000000000000000000000000000002", // 投票地址
  amount: 0,
  data: JSON.stringify({
    type: "vote",
    proposalId: "txHash",
    choice: "yes"
  })
}
```

需要在区块验证或应用层处理这些交易，更新链上状态（提案计数、投票记录）。

### 2. DApp 修改（客户端）

修改 `js/app.js`：

- 移除 `localStorage` 存储
- 从 `/chain` 端点扫描所有交易，解析提案和投票
- 提交交易时附带 `metadata` 字段（如上）
- 实时监听 `new_block` 事件更新提案状态

### 3. 参考实现

详细设计见 `docs/governance-smart-contract.md`（待编写）。

## 设计理念

### 投票权重

当前版本采用 **一地址一票** 制。未来可升级为 **代币加权投票**（Token-weighted Voting）：

```javascript
votingPower = wallet.balance; // 1 OCT = 1 票
```

### 投票时长

投票时长以**区块数**为单位，而非时间。当前难度下，每个区块约 2-10 秒。

### 提案执行

当前版本仅记录投票结果，不自动执行。实际 DAO 需要：

1. **执行器合约** - 投票通过后自动执行操作（转账、参数调整）
2. **时间锁** - 延迟执行，允许成员退出
3. **委托投票** - 未投票地址可委托给信任代表

## 生产就绪检查

- [ ] 提案创建需要签名验证（防止垃圾提案）
- [ ] 投票委托机制
- [ ] 提案过期处理（自动归档）
- [ ] 链上提案索引优化（避免全链扫描）
- [ ] 防止女巫攻击（身份验证层）

## 相关资源

- [Digital Chain 主 README](../../README.md)
- [代币经济模型](../../docs/tokenomics.md)
- [安全审计准备](../../docs/security-audit-preparation.md)
- [Governance 设计模式](https://thedailygwei.substack.com/p/dao-governance-design-patterns)

## License

MIT
