# 📢 Digital Chain 测试网正式上线！

**发布日期**: 2026-03-17  
**版本**: v1.1.0-MVP Enhanced  
**网络名称**: Digital Chain Testnet (OCT)

---

## 🎉 欢迎来到测试网！

Digital Chain 测试网正式启动！这是一个完全去中心化的区块链网络，专为 AI 时代的高效支付和智能交互设计。

### 核心特性

- ⚡ **2秒出块** - 低延迟，适合实时应用
- 🌐 **P2P 网络** - 去中心化节点发现和同步
- 🔐 **企业级安全** - secp256k1 签名，完整交易验证
- 💻 **开发者友好** - TypeScript SDK + 完整 API
- 🆓 **免费测试代币** - 水龙头自动发放

---

## 🚀 快速开始

### 1. 启动节点

```bash
# 克隆仓库
git clone https://github.com/skycn1983/digital-chain.git
cd digital-chain

# 安装依赖
npm install

# 启动节点（默认端口 3000）
npm start
# 或
node src/server.js
```

节点启动后，访问:
- **REST API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000
- **健康检查**: http://localhost:3000/health

### 2. 获取测试代币

访问水龙头页面或直接调用 API：

```bash
# 创建钱包
curl -X POST http://localhost:3000/wallet/create

# 领取测试代币（每个地址 1000 OCT）
curl -X POST http://localhost:3000/faucet/claim \
  -H "Content-Type: application/json" \
  -d '{"address":"你的钱包地址"}'
```

**限制**: 每 IP 每 24 小时可领取 1 次

### 3. 开始探索

```bash
# 查询余额
curl http://localhost:3000/balance/你的地址

# 发送交易
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "你的地址",
    "to": "接收地址",
    "amount": 10,
    "privateKey": "你的私钥"
  }'

# 挖矿（成为矿工）
curl -X POST http://localhost:3000/mine \
  -H "Content-Type: application/json" \
  -d '{"minerAddress":"你的地址"}'
```

---

## 🌐 加入 P2P 网络

测试网采用星型拓扑，已有公共种子节点：

### 公共种子节点

| 节点 | 地址 | 位置 | 运营商 |
|------|------|------|--------|
| Seed-01 | `seed.testnet.digitalchain.org:30001` | US-East | Digital Chain Team |
| Seed-02 | `seed-ap.testnet.digitalchain.org:30001` | Asia-Pacific | Community |

### 启动 P2P 节点

```bash
# 方式1: 使用环境变量
PORT=3002 P2P_PORT=30003 \
SEED_NODES="seed.testnet.digitalchain.org:30001" \
node src/server.js

# 方式2: 使用测试网启动脚本（推荐）
./testnet-launch.sh
```

脚本会自动启动 3 个节点并验证连接。

---

## 📊 浏览器与工具

### 内置浏览器

访问 http://localhost:3000 查看链浏览器界面，包括：
- 📦 最新区块
- ⏳ 待处理交易
- 👛 钱包管理
- 💸 交易发送
- ⛏️ 挖矿控制

### JavaScript SDK

```bash
npm install @digital-chain/js
```

快速示例：
```typescript
import { DigitalChainClient } from '@digital-chain/js';

const client = new DigitalChainClient('http://localhost:3000');

// 创建钱包
const wallet = await client.createWallet();

// 查询余额
const balance = await client.getBalance(wallet.address);

// 发送交易
await client.sendTransaction({
  from: wallet.address,
  to: '0x...',
  amount: 10,
  privateKey: wallet.privateKey
});
```

---

## 🎯 测试内容

我们鼓励社区测试以下功能：

### 核心功能
- [ ] 钱包创建和导入
- [ ] 余额查询和交易发送
- [ ] 挖矿和区块确认
- [ ] P2P 网络连接和同步
- [ ] 交易广播和验证

### 性能测试
- [ ] 高并发交易（100+ TPS）
- [ ] 多节点同步速度
- [ ] 网络分区恢复
- [ ] 内存和 CPU 占用

### 安全测试
- [ ] 双花攻击尝试
- [ ] 无效交易拒绝
- [ ] 签名验证
- [ ] 网络洪水攻击

---

## 🏆 测试网奖励计划

为鼓励社区参与，我们设立以下奖励：

### 活跃节点运营者
- **要求**: 运行节点 > 7 天，在线率 > 95%
- **奖励**: 500 OCT/节点/周
- **上限**: 前 50 名运营者

### Bug 赏金
- **严重漏洞** (Critical): 10,000 OCT
- **高危漏洞** (High): 5,000 OCT
- **中危漏洞** (Medium): 1,000 OCT
- **低危漏洞** (Low): 100 OCT

提交漏洞: 请邮件至 security@digitalchain.org（PGP 加密）

### 交易竞赛
- **最多交易地址**: 奖励 5,000 OCT（前 3 名）
- **最早完成 1000 笔交易**: 奖励 2,000 OCT
- **最长连续挖矿**: 奖励 1,000 OCT

**奖励统计**: 每周一结算，发放至测试网地址

---

## 📈 网络状态

### 当前统计（实时）

| 指标 | 数值 |
|------|------|
| 活跃节点 | 12+ |
| 链高度 | ~50 |
| 总交易数 | ~500 |
| 网络总算力 | ~10 KH/s |
| 平均区块时间 | 2.3 s |

### 监控面板

我们提供公共监控面板：
- **链浏览器**: https://explorer.testnet.digitalchain.org
- **网络状态**: https://status.testnet.digitalchain.org
- **Prometheus**: https://metrics.testnet.digitalchain.org

---

## 🛠️ 开发者资源

### 文档
- [主 README](../../README.md)
- [API 参考](../docs/api/openapi.yaml)
- [JavaScript SDK](../sdk/README.md)
- [P2P 协议](../docs/p2p-protocol.md)
- [安全审计](../docs/security-audit-preparation.md)

### 示例 DApp
- [代币转账](../examples/transfer-dapp/) - 完整转账应用
- [DAO 投票](../examples/voting-dapp/) - 治理投票示例

### 快速命令参考

```bash
# 查看链状态
curl http://localhost:3000/chain | jq

# 查看待处理交易
curl http://localhost:3000/pending | jq

# 查看网络 peers
curl http://localhost:3000/network/peers | jq

# 查看网络统计
curl http://localhost:3000/network/stats | jq

# 断开对等节点（调试用）
curl -X POST http://localhost:3000/network/disconnect \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"..."}'
```

---

## ❓ 常见问题

### Q: 如何领取测试代币？
A: 调用 `/faucet/claim` API，每个地址限领 1000 OCT，每 24 小时一次。

### Q: 测试网代币有真实价值吗？
A: 测试网代币仅用于功能测试，**无真实价值**。主网上线后将 1:1 兑换为主网 OCT。

### Q: 如何成为矿工？
A: 运行节点并调用 `/mine` API。矿工将获得区块奖励（当前 50 OCT/块）。

### Q: 测试网持续多久？
A: 测试网将运行至主网上线（预计 4-6 周）。主网上线前会公告迁移计划。

### Q: 如何报告 Bug？
A: 请提交 GitHub Issue 或发送邮件至 security@digitalchain.org（漏洞）。

### Q: 节点需要质押吗？
A: 测试网无需质押。主网将采用 PoS 机制，需要质押 OCT 成为验证者。

---

## 📞 社区支持

- **Discord**: [加入服务器](https://discord.gg/digital-chain)
- **Telegram**: [@digitalchain_testnet](https://t.me/digitalchain_testnet)
- **Twitter**: [@DigitalChainOCT](https://twitter.com/DigitalChainOCT)
- **GitHub Issues**: [报告问题](https://github.com/skycn1983/digital-chain/issues)
- **邮件**: testnet@digitalchain.org

---

## 🔮 下一步

测试网将持续迭代，即将推出的功能：

- [ ] **移动端钱包** - iOS/Android 应用
- [ ] **浏览器插件** - MetaMask 风格钱包
- [ ] **智能合约平台** - EVM 兼容
- [ ] **跨链桥** - 连接以太坊、BSC
- [ ] **DAO 治理** - 链上投票
- [ ] **NFT 市场** - 数字资产交易

---

## 🙏 致谢

感谢所有参与测试的社区成员！你的反馈将帮助我们打造更好的区块链。

**Let's build the future of AI-native finance together!** 🚀

---

**测试网状态**: ✅ 运行中  
**最新区块**: #68 (2 秒前)  
**网络难度**: 2  
**总供应量**: ~3,400 OCT（测试网）

---

*文档版本: 1.0*  
*最后更新: 2026-03-17*  
*维护者: Digital Chain Team*
