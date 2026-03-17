# 代币转账 DApp

简单的数字链代币转账应用，演示如何使用 JavaScript SDK 进行基本交易。

## 功能

- ✅ 创建钱包
- ✅ 查询余额
- ✅ 发送代币 (OCT)
- ✅ 实时交易状态（WebSocket）
- ✅ 交易历史查看

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript（无框架依赖）
- **SDK**: `@digital-chain/js` (可选)
- **通信**: REST API + WebSocket

## 快速开始

### 1. 启动节点

确保数字链节点正在运行（默认 `http://localhost:3000`）：

```bash
cd /path/to/digital-chain
node src/server.js
```

### 2. 启动 DApp

在 `transfer-dapp` 目录：

```bash
# 使用 http-server
npx http-server -p 8080 -o

# 或使用 Python
python -m http.server 8080
```

访问: http://localhost:8080

### 3. 快速测试流程

1. **创建钱包** - 点击"创建新钱包"
2. **获取测试代币** - 需要先挖矿
   ```bash
   # 在另一个终端
   curl -X POST http://localhost:3000/mine \
     -H "Content-Type: application/json" \
     -d '{"minerAddress":"你的钱包地址"}'
   ```
   重复 5-10 次，获得足够余额
3. **发送交易** - 输入接收地址、金额，点击"发送交易"
4. **查看状态** - 待处理交易、链状态、最近区块实时更新

## 使用说明

### 创建钱包

1. 点击 "🆕 创建新钱包" 按钮
2. 保存生成的私钥（重要！刷新页面将丢失）
3. 钱包地址会自动填充

### 获取测试代币

如果余额为 0，需要挖矿：

```bash
curl -X POST http://localhost:3000/mine \
  -H "Content-Type: application/json" \
  -d '{"minerAddress":"你的地址"}'
```

### 发送交易

1. 输入接收地址
2. 输入转账金额
3. 点击 "📤 发送交易"
4. 等待交易确认（约 2 秒）

### 实时更新

WebSocket 连接会自动推送：
- 新区块确认
- 交易状态变化
- 余额更新

## 技术架构

### 文件结构

```
transfer-dapp/
├── index.html          # 主界面
├── css/
│   └── style.css      # 响应式样式
├── js/
│   └── app.js         # 应用逻辑、API 调用、WebSocket
├── package.json       # 项目配置
└── README.md          # 本文档
```

### 核心模块

| 模块 | 说明 |
|------|------|
| `index.html` | 单页面应用，包含钱包、转账、链状态面板 |
| `js/app.js` | 封装所有区块链交互（REST + WebSocket） |
| `css/style.css` | iOS 风格设计，支持移动端 |

### API 依赖

| 端点 | 用途 |
|------|------|
| `POST /wallet/create` | 创建钱包 |
| `GET /balance/:address` | 查询余额 |
| `GET /nonce/:address` | 查询交易计数 |
| `POST /transaction` | 提交交易 |
| `POST /mine` | 挖矿 |
| `GET /chain` | 获取链数据 |
| `GET /pending` | 待处理交易 |
| `WS /ws` | 实时事件推送 |

## 故障排除

| 问题 | 原因 | 解决 |
|------|------|------|
| "Failed to fetch" | 节点未启动或端口错误 | 启动节点，检查 `http://localhost:3000/health` |
| 余额始终 0 | 未挖矿或挖矿地址错误 | 确认 minerAddress 匹配钱包地址 |
| 交易 rejected | nonce 冲突、余额不足 | 等待上确认或重启节点重置 |
| WebSocket 未连接 | 节点未启用 WS | 检查 server.js 是否启动 WebSocketServer |
| 私钥丢失 | 刷新页面 | 私钥仅存储在内存，请务必保存 |

### 查看节点日志

```bash
tail -f logs/node*.log
```

### 重置节点数据

```bash
rm -rf data/chain.json data/pending.json
node src/server.js
```

## 扩展开发

### 添加新功能

1. **交易历史** - 扫描链上所有交易，过滤本钱包相关
2. **多钱包管理** - localStorage 存储多个钱包，切换显示
3. **二维码收款** - 使用 `qrcode.js` 生成地址二维码
4. **Gas 费用估算** - 调用 `/chain` 获取 difficulty，计算建议 gasPrice

### 集成 SDK

本示例直接调用 REST API。如需 TypeScript 类型安全，可集成官方 SDK：

```bash
npm install @digital-chain/js
```

然后替换 `js/app.js` 中的 fetch 调用为 SDK 方法：

```javascript
import { DigitalChainClient } from '@digital-chain/js';
const client = new DigitalChainClient('http://localhost:3000');
const balance = await client.getBalance(address);
```

### 生产环境注意事项

⚠️ **本示例仅用于开发和测试！**

生产部署前必须：
- [ ] 使用 HTTPS/WSS
- [ ] 私钥加密存储（浏览器 IndexedDB + 密码）
- [ ] 实现 Keystore 文件导出（JSON 加密）
- [ ] 添加 API 认证（CORS 限制）
- [ ] 防止 XSS（转义所有用户输入）
- [ ] 交易确认二次确认（弹窗）

## 相关资源

- [Digital Chain 主 README](../../README.md)
- [JavaScript SDK](../../sdk/README.md)
- [P2P 网络文档](../../docs/p2p-protocol.md)
- [API 参考](../../docs/api/openapi.yaml)

## License

MIT
