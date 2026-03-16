# 快速入门指南

本指南帮助你快速启动 Digital Chain 节点并进行基本操作。

## 前置要求

- Node.js 18+ (推荐 20+)
- npm 或 yarn

## 步骤 1: 克隆与安装

```bash
cd digital-chain
npm install
```

这将安装依赖：
- express 5.x - HTTP 服务器
- elliptic 6.x - secp256k1 加密
- ws 8.x - WebSocket 支持

## 步骤 2: 启动节点

```bash
npm start
# 或
node src/server.js
```

预期输出：
```
🚀 Digital Chain Node Started
📍 API Server: http://localhost:3000
🔗 Current height: X blocks
⛏️  Block reward: 50 OCT
🔗 WebSocket server running on ws://localhost:3000
```

## 步骤 3: 验证节点运行

打开浏览器访问 http://localhost:3000

你会看到链浏览器界面，显示：
- 📊 链状态（高度、难度、奖励、待处理交易）
- 👛 钱包管理
- 💸 发送交易
- ⛏️ 挖矿控制
- 📦 区块列表

## 步骤 4: 创建第一个钱包

### 使用 Web UI

1. 点击"创建新钱包"按钮
2. 保存显示的地址、公钥、私钥（⚠️ 私钥必须妥善保存！）

### 使用 cURL

```bash
curl -X POST http://localhost:3000/wallet/create
```

响应：
```json
{
  "success": true,
  "address": "0x4f056861698045145ee945f82d85dd0e55c9bea4",
  "publicKey": "04a06f26ec20a868184dbec206b67c11db2bb496b806373ee2a69f1c54070742e0364f45995e01d6ac1b181083eb902e9d5a3622ec3e5bb4f4b633b872784e1a6e",
  "privateKey": "e88284626afa86567987c860b43659463d5efefcb04336ab400c411fa271f359",
  "message": "Wallet created. Save private key securely!"
}
```

## 步骤 5: 获得初始代币

新钱包余额为 0，需要挖矿获得代币。

### 方式 A: 在 Web UI 中挖矿

1. 在"挖矿控制"卡片中，粘贴你的钱包地址
2. 点击"挖矿"按钮

### 方式 B: 使用 cURL

```bash
curl -X POST http://localhost:3000/mine \
  -H "Content-Type: application/json" \
  -d '{"minerAddress": "YOUR_ADDRESS"}'
```

每次挖矿奖励 **50 OCT**。

## 步骤 6: 发送交易

### 使用 Web UI

1. 在"创建交易"卡片中：
   - 发送方地址：你的地址
   - 接收方地址：另一个钱包地址
   - 金额：任意数字（如 10）
2. 点击"创建交易"

### 使用 cURL

```bash
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "SENDER_ADDRESS",
    "to": "RECEIVER_ADDRESS",
    "amount": 10
  }'
```

注意：交易需要被挖矿才能确认。交易创建后：
- 进入待处理交易池（pending）
- 挖矿后被打包进区块
- 接收方余额增加

## 步骤 7: 实时监控（WebSocket）

### 使用浏览器

Web UI 已自动连接 WebSocket，你会看到：
- 链状态自动更新
- 新区块出现提示
- 待处理交易数变化

### 使用 JavaScript

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('Event:', msg.type, msg.data);
});

// 事件类型:
// - chain_update: 链状态更新
// - new_block: 新区块
// - new_transaction: 新交易
```

## 常用 API 速查

| 操作 | 端点 | 方法 |
|------|------|------|
| 创建钱包 | `/wallet/create` | POST |
| 查询余额 | `/balance/:address` | GET |
| 查询Nonce | `/nonce/:address` | GET |
| 创建交易 | `/transaction` | POST |
| 挖矿 | `/mine` | POST |
| 链信息 | `/chain` | GET |
| 指定区块 | `/block/:index` | GET |
| 待处理交易 | `/pending` | GET |
| 健康检查 | `/health` | GET |

## 下一步

- 阅读 [API 参考](api/openapi.yaml) 了解所有端点
- 查看 [代码示例](examples/) 学习编程调用
- 了解 [WebSocket 事件](../README.md#🔌-websocket-实时事件)
- 学习 [部署到生产环境](deployment/docker.md)

## 故障排除

### 问题: 交易失败 "Insufficient balance"
**原因**: 发送方余额不足
**解决**: 先挖矿获得代币

### 问题: WebSocket 连接断开
**原因**: 服务器重启或网络问题
**解决**: 客户端会自动重连（5秒后）

### 问题: 挖矿太慢
**原因**: 难度较高或 CPU 性能有限
**解决**: 降低 `DIFFICULTY` 环境变量（默认 2）

---

祝你玩得开心！🎉
