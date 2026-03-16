# JavaScript SDK 开发计划

**目标**: 创建 `@digital-chain/js` npm 包，降低开发者使用门槛
**预计时间**: 4-6 小时
**技术栈**: TypeScript + JavaScript（支持两种入口）

---

## 一、SDK 架构设计

### 核心模块

```
@digital-chain/js/
├── src/
│   ├── index.ts           # 主入口，导出所有类
│   ├── client.ts          # DigitalChainClient (组合所有功能)
│   ├── wallet.ts          # Wallet 类（创建、导入、签名）
│   ├── blockchain.ts      # Blockchain 类（REST + WS 客户端）
│   ├── transaction.ts     # Transaction 构建器
│   ├── types.ts           # TypeScript 类型定义
│   ├── utils/
│   │   ├── crypto.ts      # 加密工具（复用链上逻辑）
│   │   └── serializer.ts  # 序列化工具
│   └── constants.ts       # 常量（端口、端点、默认值）
├── examples/
│   ├── 01-create-wallet.ts
│   ├── 02-send-transaction.ts
│   ├── 03-mine-block.ts
│   ├── 04-websocket-subscribe.ts
│   └── 05-query-balance.ts
├── tests/
│   └── integration.test.ts
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## 二、API 设计

### 1. DigitalChainClient（主类）

```typescript
class DigitalChainClient {
  constructor(config: ClientConfig);
  
  // Wallet 操作
  createWallet(): Wallet;
  importWallet(privateKey: string): Wallet;
  
  // Blockchain 查询（REST）
  async getBalance(address: string): Promise<number>;
  async getNonce(address: string): Promise<number>;
  async getChainInfo(): Promise<ChainInfo>;
  async getBlock(index: number): Promise<Block>;
  async getPendingTransactions(): Promise<Transaction[]>;
  
  // 交易发送
  async sendTransaction(tx: TransactionOptions): Promise<TransactionResult>;
  async sendSignedTransaction(signedTx: SignedTransaction): Promise<TransactionResult>;
  
  // 挖矿
  async mineBlock(minerAddress: string): Promise<Block>;
  
  // WebSocket 订阅
  on(event: 'chain_update', handler: (data: ChainInfo) => void): void;
  on(event: 'new_block', handler: (block: Block) => void): void;
  on(event: 'new_transaction', handler: (tx: Transaction) => void): void;
  disconnect(): void;
  
  // 健康检查
  async health(): Promise<HealthStatus>;
}
```

### 2. Wallet 类

```typescript
class Wallet {
  constructor(privateKey?: string);
  
  readonly address: string;
  readonly publicKey: string;
  
  // 签名
  sign(message: string): string;
  signTransaction(tx: Transaction): SignedTransaction;
  
  // 导出
  toJSON(): { address: string; publicKey: string };
  exportPrivateKey(): string; // 警告：谨慎使用
  
  // 静态方法
  static generate(): Wallet;
  static fromPrivateKey(privateKey: string): Wallet;
  static fromPublicKey(publicKey: string): Wallet;
}
```

### 3. Transaction 构建器

```typescript
interface TransactionOptions {
  from: string;      // 发送方地址
  to: string;        // 接收方地址
  amount: number;    // 金额
  gasPrice?: number; // 默认 1
  gasLimit?: number; // 默认 21000
  data?: string;     // 合约数据
}

class Transaction {
  constructor(options: TransactionOptions);
  
  readonly hash: string;
  readonly nonce: number;
  readonly timestamp: number;
  
  sign(wallet: Wallet): SignedTransaction;
  serialize(): SerializedTransaction;
  
  static deserialize(data: SerializedTransaction): Transaction;
}
```

### 4. 类型定义

```typescript
interface ChainInfo {
  blocks: number;
  pending: number;
  difficulty: number;
  reward: number;
  latestHash: string;
  valid: boolean;
}

interface Block {
  index: number;
  hash: string;
  previousHash: string;
  transactions: Transaction[];
  timestamp: number;
  nonce: number;
  difficulty: number;
  merkleRoot: string;
}

interface TransactionResult {
  success: boolean;
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
}
```

---

## 三、实现细节

### 1. 依赖选择

**核心依赖**:
- `cross-fetch` - 跨平台 fetch（浏览器 + Node）
- `ws` - WebSocket 客户端
- `elliptic` - ECDSA 签名（复用链上代码）
- `bn.js` - 大数运算（可选）

**开发依赖**:
- `typescript` - 编译
- `@types/node`, `@types/ws` - 类型定义
- `jest` + `@types/jest` - 测试
- `esbuild` 或 `tsup` - 打包

### 2. 配置选项

```typescript
interface ClientConfig {
  // REST API 地址
  restUrl?: string;      // 默认: http://localhost:3000
  
  // WebSocket 地址
  wsUrl?: string;        // 默认: ws://localhost:3000
  
  // P2P 端口（可选，用于直接连接）
  p2pPort?: number;      // 默认: 30001
  
  // 超时设置
  timeout?: number;      // 默认: 10000ms
  
  // 日志级别
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

### 3. 错误处理

```typescript
class DigitalChainError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: any
  );
}

// 错误码
const ERR = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_NONCE: 'INVALID_NONCE',
  TRANSACTION_REJECTED: 'TRANSACTION_REJECTED',
  MINING_FAILED: 'MINING_FAILED',
  WEBSOCKET_CLOSED: 'WEBSOCKET_CLOSED'
};
```

---

## 四、使用示例

### 示例 1: 创建钱包并查询余额

```typescript
import { DigitalChainClient } from '@digital-chain/js';

const client = new DigitalChainClient({
  restUrl: 'http://localhost:3000'
});

// 创建钱包
const wallet = client.createWallet();
console.log('Address:', wallet.address);
console.log('Private Key:', wallet.exportPrivateKey()); // ⚠️ 仅测试环境

// 查询余额
const balance = await client.getBalance(wallet.address);
console.log('Balance:', balance, 'OCT');
```

### 示例 2: 发送交易

```typescript
const alice = client.createWallet();
const bob = client.createWallet();

// 挖矿获得代币（测试网）
await client.mineBlock(alice.address);
await client.mineBlock(alice.address); // 两次获得 100 OCT

// 发送交易
const result = await client.sendTransaction({
  from: alice.address,
  to: bob.address,
  amount: 50
});

console.log('Transaction hash:', result.hash);
console.log('Nonce:', result.nonce);
```

### 示例 3: WebSocket 实时监听

```typescript
const client = new DigitalChainClient({
  wsUrl: 'ws://localhost:3000'
});

// 监听新区块
client.on('new_block', (block) => {
  console.log(`New block #${block.index} mined: ${block.hash}`);
});

// 监听新交易
client.on('new_transaction', (tx) => {
  console.log(`New tx: ${tx.from} → ${tx.to} (${tx.amount} OCT)`);
});

// 链状态更新
client.on('chain_update', (info) => {
  console.log(`Chain height: ${info.blocks}, pending: ${info.pending}`);
});
```

### 示例 4: 导入现有钱包

```typescript
const client = new DigitalChainClient();

// 从私钥导入
const wallet = client.importWallet('0xabc123...');

// 签名消息
const signature = wallet.sign('Hello Digital Chain');
```

---

## 五、打包和发布

### 1. package.json

```json
{
  "name": "@digital-chain/js",
  "version": "1.0.0",
  "description": "JavaScript/TypeScript SDK for Digital Chain",
  "main": "dist/index.js",
  "module": "dist/index.esm.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["blockchain", "cryptocurrency", "digital-chain", "sdk"],
  "author": "小明",
  "license": "MIT",
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsup": "^8.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  },
  "dependencies": {
    "cross-fetch": "^4.0.0",
    "ws": "^8.0.0",
    "elliptic": "^6.6.0"
  }
}
```

### 2. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "examples", "tests"]
}
```

---

## 六、开发任务清单

### 阶段 1: 基础框架（1 小时）
- [ ] 创建 `sdk/` 目录结构
- [ ] 初始化 `package.json` 和 `tsconfig.json`
- [ ] 实现 `types.ts`（所有 TypeScript 类型）
- [ ] 实现 `utils/crypto.ts`（签名、验证、地址派生）
- [ ] 实现 `constants.ts`（默认 URL、端口）

### 阶段 2: 核心类（2 小时）
- [ ] `wallet.ts` - Wallet 类（生成、导入、签名）
- [ ] `transaction.ts` - Transaction 构建器（序列化、反序列化）
- [ ] `blockchain.ts` - Blockchain 客户端（REST API 调用）
- [ ] `client.ts` - DigitalChainClient（组合所有功能）

### 阶段 3: WebSocket（1 小时）
- [ ] 在 `client.ts` 添加 WebSocket 连接
- [ ] 实现事件监听器（on, off）
- [ ] 自动重连机制
- [ ] 消息解析和类型转换

### 阶段 4: 测试（1 小时）
- [ ] 单元测试（wallet, transaction 序列化）
- [ ] 集成测试（连接真实节点）
- [ ] 测试覆盖率 > 80%

### 阶段 5: 示例和文档（1 小时）
- [ ] 编写 5 个示例（创建钱包、发送交易、挖矿、WebSocket、查询）
- [ ] 撰写 README.md（快速开始、API 参考、示例）
- [ ] 打包构建（tsup）
- [ ] 本地 npm link 测试

---

## 七、复用链上代码策略

为避免代码重复，SDK 应该：

1. **复制核心算法**（crypto, transaction hashing）
   - 从 `src/crypto.js` 移植到 `sdk/src/utils/crypto.ts`
   - 保持算法一致（secp256k1, SHA256, RIPEMD160）

2. **独立实现**（不依赖链上代码）
   - SDK 是独立包，不能依赖 `digital-chain` 核心代码
   - 但算法必须 100% 兼容

3. **共享测试向量**
   - 使用相同的测试用例验证签名
   - 确保 SDK 生成的签名能被链验证

---

## 八、发布准备

### 1. npm 发布

```bash
# 登录 npm（如果需要）
npm login

# 发布（需要 npm 账号）
npm publish --access public
```

**包名**: `@digital-chain/js`（需要注册 scope）

### 2. 版本策略

- 主版本: 破坏性变更
- 次版本: 新功能（向后兼容）
- 补丁版本: bug 修复

遵循 SemVer 规范。

### 3. 文档托管

- README 托管在 GitHub
- API 文档自动生成（TypeDoc）
- 示例代码在 `examples/` 目录

---

## 九、质量保证

### 测试覆盖
- ✅ Wallet 生成和导入
- ✅ 交易签名和验证
- ✅ REST API 调用
- ✅ WebSocket 连接和事件
- ✅ 错误处理（网络超时、无效响应）

### 性能基准
- 钱包创建: < 10ms
- 交易签名: < 5ms
- REST 调用: < 100ms (本地)
- WebSocket 连接: < 50ms

---

## 十、立即开始

我现在创建 SDK 目录结构和基础文件，按阶段实现。

**预计完成时间**: 今天下午 18:00 前完成可用的 SDK 包。

---

开始编码！
