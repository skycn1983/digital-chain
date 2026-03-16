# 📡 P2P 网络协议规范

**版本**: v0.1
**日期**: 2026-03-16
**目标**: 实现数字链的去中心化节点通信

---

## 1. 概述

数字链 P2P 网络采用**自定义 TCP 协议**（而非 libp2p，为了简化实现），使用**长度前缀帧 + JSON 消息体**的格式。

### 核心特性
- 无中心服务器，全节点平等
- 自动节点发现（种子节点 + mDNS）
- 交易和区块的 Gossip 广播
- 链同步和分叉处理
- 心跳和连接管理

### 端口分配
| 用途 | 端口 | 协议 | 说明 |
|------|------|------|------|
| P2P 主连接 | 30001 | TCP | 节点间通信 |
| mDNS 发现 | 30002 | UDP | 局域网节点发现 |
| REST API | 3000 | TCP | HTTP API（已有） |
| WebSocket | 3000 | WS | 前端实时推送（已有） |

---

## 2. 消息格式

### 2.1 帧结构 (Frame Format)

```
+----------------+------------------+
| 4-byte length | JSON payload    |
+----------------+------------------+
```

- **length**: unsigned 32-bit integer (big-endian)，表示 JSON payload 的字节长度
- **payload**: UTF-8 编码的 JSON 对象

**示例** (发送 `{"type":"ping"}`):
```
0000000F 7B22747970":2270696E67222D7D
```

### 2.2 消息信封 (Message Envelope)

所有消息使用统一的 envelope 格式：

```typescript
interface Message {
  type: MessageType;      // 消息类型（见下表）
  payload: any;           // 消息体（类型依赖 type）
  timestamp: number;      // 发送时间戳（毫秒）
  nodeId?: string;        // 发送方节点 ID（可选，用于追踪）
}
```

### 2.3 消息类型 (MessageType)

| 类型 | 方向 | 描述 | Payload 结构 |
|------|------|------|--------------|
| `handshake` | 双向 | 连接握手 | `HandshakePayload` |
| `ping` / `pong` | 双向 | 心跳检测 | `PingPongPayload` |
| `get_peers` | 双向 | 请求 peers 列表 | `{}` |
| `peers` | 双向 | 响应 peers 列表 | `PeersPayload` |
| `get_blocks` | 请求 | 请求区块 | `GetBlocksPayload` |
| `blocks` | 响应 | 返回区块列表 | `BlocksPayload` |
| `tx_broadcast` | 双向 | 广播交易 | `TxBroadcastPayload` |
| `new_block` | 双向 | 广播新区块 | `NewBlockPayload` |
| `error` | 双向 | 错误响应 | `ErrorPayload` |

---

## 3. 消息体定义

### 3.1 HandshakePayload

连接建立后的第一次握手。

```typescript
interface HandshakePayload {
  protocolVersion: string;    // 协议版本，如 "0.1"
  nodeId: string;             // 发送方节点唯一 ID（公钥派生）
  address: string;            // 发送方地址（ip:port）
  chainHeight: number;        // 当前链高度
  difficulty: number;         // 当前难度
  blockReward: number;        // 出块奖励
  userAgent: string;          // 客户端标识，如 "digital-chain/1.0"
}
```

**握手流程**:
1. 客户端连接服务器后，立即发送 `handshake`
2. 服务器验证协议版本，响应 `handshake`
3. 双方记录对方信息到 peer 表
4. 如果对方链高度更高，触发 `get_blocks` 请求

### 3.2 PingPongPayload

```typescript
interface PingPongPayload {
  nonce: number;        // 随机数，防止缓存攻击
}
```

**心跳策略**:
- 每 30 秒发送一次 `ping`
- 收到 `ping` 后立即回复 `pong`
- 连续 3 次 `ping` 未响应，断开连接

### 3.3 PeersPayload

```typescript
interface PeersPayload {
  peers: PeerInfo[];    // 已知 peers 列表
}
```

**PeerInfo**:
```typescript
interface PeerInfo {
  nodeId: string;
  address: string;      // ip:port
  chainHeight: number;
  lastSeen: number;     // 时间戳
}
```

**使用场景**:
- 新节点启动时，连接种子节点后发送 `get_peers`
- 种子节点响应 `peers` 提供其他节点地址
- 定期交换 peer 列表（每 10 分钟）

### 3.4 GetBlocksPayload

请求从指定高度开始的区块列表。

```typescript
interface GetBlocksPayload {
  fromHeight: number;       // 起始高度（ inclusive）
  limit: number;            // 最大返回数量，建议 100
}
```

**响应**: `BlocksPayload`

### 3.5 BlocksPayload

返回区块列表（序列化格式）。

```typescript
interface BlocksPayload {
  blocks: BlockSerialized[];   // 区块数组
  totalCount: number;          // 总数量（用于分页）
}
```

**BlockSerialized** (参考 `Block.serialize()`):
```typescript
interface BlockSerialized {
  index: number;
  previousHash: string;
  timestamp: number;
  nonce: number;
  difficulty: number;
  hash: string;
  transactions: TxSerialized[];
  merkleRoot: string;
}
```

**TxSerialized**:
```typescript
interface TxSerialized {
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
  gasPrice: number;
  gasLimit: number;
  timestamp: number;
  signature?: string;
}
```

### 3.6 TxBroadcastPayload

广播一笔新交易。

```typescript
interface TxBroadcastPayload {
  transaction: TxSerialized;   // 完整交易对象
}
```

**处理流程**:
1. 接收交易后验证（签名、余额、nonce）
2. 验证失败：回复 `error` 并丢弃
3. 验证通过：加入 pending pool，并继续广播给其他 peers（洪水算法）

**防垃圾**:
- 每笔交易必须附带足够的 gas
- 同一地址 nonce 必须递增
- 单节点 10 秒内最多广播 100 笔交易

### 3.7 NewBlockPayload

广播新区块（挖矿成功后）。

```typescript
interface NewBlockPayload {
  block: BlockSerialized;
  reward: number;            // 出块奖励
  miner: string;             // 矿工地址
}
```

**处理流程**:
1. 验证区块（难度、哈希、交易签名）
2. 如果区块是当前链的延伸：接受并添加到链
3. 如果触发分叉：选择累计难度最大的链
4. 继续广播给其他 peers

### 3.8 ErrorPayload

错误响应。

```typescript
interface ErrorPayload {
  code: number;          // 错误码（见下表）
  message: string;       // 人类可读描述
  requestId?: string;    // 关联请求 ID（如果有）
}
```

**错误码**:
| 代码 | 含义 |
|------|------|
| 1001 | 协议版本不匹配 |
| 1002 | 节点已满，拒绝连接 |
| 2001 | 交易签名无效 |
| 2002 | 余额不足 |
| 2003 | Nonce 错误 |
| 3001 | 区块难度不满足 |
| 3002 | 区块哈希校验失败 |
| 3003 | 分叉太长，拒绝切换 |

---

## 4. 连接流程

### 4.1 出站连接（主动连接他人）

```
客户端                            服务器
  | -- SYN (TCP) -->                |
  | <-- SYN-ACK --|                 |
  | -- ACK ------>                  |
  | -- handshake -->                |
  | <-- handshake --|               |
  | (连接建立成功)                  |
```

1. 解析目标地址 `ip:port`
2. TCP 连接建立
3. 发送 `handshake` 消息
4. 等待服务器 `handshake` 响应
5. 验证响应中的 `protocolVersion` 和 `chainHeight`
6. 记录 peer 信息，连接完成

### 4.2 入站连接（他人连接我）

```
客户端                            服务器
  | -- SYN (TCP) -->                |
  | <-- SYN-ACK --|                 |
  | -- ACK ------>                  |
  | <-- handshake --|               |
  | -- handshake -->                |
  | (连接建立成功)                  |
```

1. 服务器接受 TCP 连接
2. 等待客户端发送 `handshake`
3. 验证客户端协议版本
4. 发送本节点的 `handshake`
5. 检查是否已达到最大连接数，如果是，发送 `error` 并关闭
6. 记录 peer 信息，连接完成

---

## 5. 广播策略

### 5.1 交易广播

**洪水算法 (Flooding)**:
1. 收到有效交易后，加入 pending pool
2. 立即广播给所有已连接的 peers（不包括来源 peer）
3. 每个 peer 收到后，如果未见过（基于 tx hash 去重），继续广播
4. 使用指数退避避免广播风暴（同一交易 5 秒内不重复广播）

**反垃圾措施**:
```javascript
if (tx.amount < MIN_TX_AMOUNT) reject();        // 金额太小
if (tx.gasPrice * tx.gasLimit < MIN_FEE) reject(); // Gas 费不足
if (nonce <= lastSeenNonce[from]) reject();    // Nonce 回退
```

### 5.2 区块广播

**立即广播**:
1. 挖到新区块后，序列化为 `BlockSerialized`
2. 广播 `new_block` 给所有 peers
3. 如果 peer 落后较多，可能触发 `get_blocks` 请求

**广播确认**:
- 不等待确认，fire-and-forget
- 记录每个 peer 最后已知区块高度
- 如果 peer 持续落后，触发同步流程

---

## 6. 链同步算法

### 6.1 同步触发条件

| 场景 | 触发动作 |
|------|----------|
| 新连接建立，对方 `chainHeight` > 本地 | 发送 `get_blocks` 从本地高度+1 开始 |
| 收到 `new_block`，区块索引 > 本地高度+1 | 发送 `get_blocks` 从本地高度+1 开始 |
| 定期检查（每 5 分钟） | 向随机 peer 请求链高度，如落后则同步 |

### 6.2 同步流程

```
本地 (height=100)   <--->   远程 (height=150)
     |                           |
     | -- get_blocks {from:101} ->|
     | <-- blocks {50 blocks} ---|
     |                           |
     | (按顺序验证并添加)        |
     | (选择最长/最难链)         |
     |                           |
     | --> 高度变为 150          |
```

**验证规则**:
1. 按索引顺序应用区块
2. 每个区块必须满足：
   - `previousHash` 匹配前一个区块的 `hash`
   - `hash` 满足当前 `difficulty`（前导零数量）
   - 所有交易签名有效
   - 交易 nonce 递增
   - 余额充足
3. 如果任何区块验证失败，**丢弃整个批次**，请求重新同步

### 6.3 分叉处理

**场景**: 收到两个不同版本的链（A 链和 B 链）

**选择规则**（最长链原则 + 累计难度）:
```javascript
function chooseCanonicalChain(chains) {
  // 1. 选择累计 difficulty 最大的链
  // 2. 如果 difficulty 相同，选择最长链
  // 3. 如果还相同，选择最早接收的链（FIFO）
}
```

** orphan 处理**:
- 被抛弃的区块放入 `orphans` 缓存（最多 100 个）
- 如果未来该区块成为最长链，重新激活
- orphan 缓存 TTL: 1 小时

---

## 7. 节点发现

### 7.1 种子节点 (Seeds)

**配置**: `config/seed-nodes.json`
```json
[
  { "address": "192.168.1.100:30001", "nodeId": "abc123..." },
  { "address": "seed.digitalchain.io:30001", "nodeId": "def456..." }
]
```

**启动流程**:
1. 读取种子节点列表
2. 尝试连接每个种子节点
3. 成功连接后，发送 `get_peers` 请求
4. 将返回的 peers 加入候选列表
5. 如果种子节点全部失败，使用 mDNS 继续发现

### 7.2 mDNS 局域网发现

**协议**: Multicast DNS (mDNS) on UDP 30002

**广播消息** (每 60 秒):
```json
{
  "type": "mdns_announce",
  "nodeId": "abc123...",
  "address": "192.168.1.200:30001",
  "chainHeight": 150,
  "protocolVersion": "0.1"
}
```

**监听**:
- 监听 `224.0.0.251:30002` (IPv4) 或 `ff02::fb:30002` (IPv6)
- 收到 announce 后，如果没见过该 nodeId，尝试连接
- 定期清理未响应的 mDNS 节点（TTL 5 分钟）

### 7.3 Peer 交换

**定期交换** (每 10 分钟):
1. 随机选择 5 个 connected peers
2. 发送 `get_peers` 请求
3. 合并返回的 peers 去重
4. 连接新的 peers（最多扩展到 20 个出站连接）

---

## 8. 连接管理

### 8.1 连接池配置

```javascript
const CONFIG = {
  maxInboundConnections: 50,     // 最大入站连接
  maxOutboundConnections: 20,    // 最大出站连接
  maxTotalConnections: 100,      // 总连接上限
  handshakeTimeout: 10000,       // 握手超时 10s
  pingInterval: 30000,           // 心跳间隔 30s
  pingTimeout: 10000,            // 心跳响应超时 10s
  reconnectInterval: 5000,       // 重连间隔 5s
  maxReconnectAttempts: 10,      // 最大重连次数
};
```

### 8.2 状态机

```
disconnected
   |
   | (connect)
   v
connecting  --(timeout)-->  disconnected
   |
   | (handshake success)
   v
connected  --(inactivity)-->  disconnected
   |
   | (send ping)
   v
waiting_for_pong  --(timeout)-->  disconnected
   |
   | (receive pong)
   v
connected
```

### 8.3 自动重连

- 保存最近成功连接的 10 个 peers
- 断开后 5 秒开始重连
- 指数退避：2s, 4s, 8s, 16s, ...
- 最多重连 10 次，然后停止，等待手动触发

---

## 9. 安全考虑

### 9.1 输入验证

**所有外部输入必须验证**:
- 消息格式（JSON 解析失败则断开）
- 字段类型和范围（如高度必须 >= 0）
- 消息大小（单个消息 < 10 MB）
- 消息频率（每 IP 每分钟 < 1000 条）

### 9.2 DoS 防护

```javascript
// 每 IP 限制
if (connectionsPerIP[ip] > MAX_CONN_PER_IP) reject();
if (messagesPerMinute[ip] > 1000) throttle();
if (failedHandshakes[ip] > 5) ban(ip, 1 hour);
```

### 9.3 数据隐私

**不泄露**:
- 不广播涉及隐私的交易细节（金额对所有节点可见是预期行为）
- 不记录 IP 地址日志（仅在内存中临时存储）
- 不验证身份（完全匿名网络）

---

## 10. 向后兼容性

- 协议版本号 `protocolVersion` 在 handshake 中传递
- 如果版本不匹配，拒绝连接并发送 `error` (code 1001)
- 未来升级时，支持多个版本并行运行至少 6 个月
- 旧版本节点可以连接，但功能受限（例如无法接收新类型消息）

---

## 11. 监控和调试

### 11.1 日志级别

```javascript
const LOG_LEVELS = {
  DEBUG:  0,  // 所有消息 dump
  INFO:   1,  // 连接/断开、区块/交易广播
  WARN:   2,  // 验证失败、重复消息
  ERROR:  3,  // 连接错误、协议违规
  NONE:   4,  // 无日志
};
```

### 11.2 指标 (Metrics)

暴露 `/metrics` endpoint（或直接日志输出）:
```
p2p_connections_active 25
p2p_connections_total 150
p2p_tx_broadcasted 12345
p2p_blocks_synced 678
p2p_bytes_received 1048576
p2p_bytes_sent 2097152
p2p_peers_by_height{height="150"} 10
```

### 11.3 调试命令

`GET /network/debug/peers` - 列出所有 peers
`GET /network/debug/messages?limit=100` - 最近 100 条消息日志
`POST /network/disconnect?nodeId=xxx` - 强制断开连接

---

## 12. 实现检查清单

### 模块结构
```
src/p2p/
├── server.js         # TCP 服务器，监听 30001
├── client.js         # 出站连接管理
├── peer.js           # Peer 类（状态、信息）
├── message.js        # 消息编解码（长度前缀）
├── handshake.js      # 握手协议
├── messages/         # 消息类型定义
│   ├── ping.js
│   ├── pong.js
│   ├── get_peers.js
│   ├── peers.js
│   ├── get_blocks.js
│   ├── blocks.js
│   ├── tx_broadcast.js
│   ├── new_block.js
│   └── error.js
├── discovery/
│   ├── mdns.js       # mDNS 发现
│   ├── seeds.js      # 种子节点管理
│   └── peer-exchange.js  # peer 交换
├── sync/
│   ├── chain-sync.js # 链同步逻辑
│   ├── fork-choice.js # 分叉选择
│   └── orphan-pool.js # orphan 缓存
├── broadcast/
│   ├── gossip.js     # Gossip 广播算法
│   ├── tx-relay.js   # 交易中继
│   └── block-relay.js # 区块中继
└── utils/
    ├── rate-limit.js # 速率限制
    └── metrics.js    # 指标收集
```

### 集成点

在 `server.js` 中:
```javascript
const p2p = new P2PServer(blockchain);
p2p.start();

// 覆盖 broadcast 函数，同时推送 WS 和 P2P
blockchain.broadcast = (event, data) => {
  broadcastWS(event, data);  // 已有
  broadcastP2P(event, data); // 新增
};
```

---

## 13. 测试计划

### 单元测试
- [ ] 消息编解码（round-trip）
- [ ] 握手流程
- [ ] 交易验证
- [ ] 区块验证
- [ ] 链同步（单个缺失区块）
- [ ] 分叉处理（两条竞争链）

### 集成测试
- [ ] 3 节点网络：交易广播和确认
- [ ] 5 节点网络：区块同步（不同起点）
- [ ] 节点重启：从持久化数据恢复
- [ ] 网络分区：断开 1 分钟后重连同步
- [ ] 恶意节点：发送无效消息、无效区块

### 压力测试
- [ ] 100 个并发连接
- [ ] 1000 tx/s 广播吞吐量
- [ ] 100 block/s 广播吞吐量
- [ ] 10 MB 消息大小（极端情况）

---

## 附录 A: 示例会话

### A.1 正常握手流程

```
客户端 (height=100)                          服务器 (height=150)
                                          (监听 30001)
   | -- TCP connect ----------------------> |
   |                                        |
   | -- handshake {                        |
   |   protocolVersion: "0.1",             |
   |   nodeId: "client123",               |
   |   address: "192.168.1.10:30001",     |
   |   chainHeight: 100,                  |
   |   difficulty: 2,                     |
   |   blockReward: 50,                   |
   |   userAgent: "digital-chain/1.0"    |
   | } ----------------------------------> |
   |                                        |
   | <-- handshake {                       |
   |   protocolVersion: "0.1",             |
   |   nodeId: "server456",               |
   |   address: "192.168.1.20:30001",     |
   |   chainHeight: 150,                  |
   |   difficulty: 2,                     |
   |   blockReward: 50,                   |
   |   userAgent: "digital-chain/1.0"    |
   | } -----------------------------------|
   |                                        |
   | (发现服务器更高)                      |
   | -- get_blocks {fromHeight: 101, limit: 100} -> |
   |                                        |
   | <-- blocks {blocks: [...50 blocks...]} -----|
   |                                        |
   | (按顺序应用区块)                      |
   | (高度变为 150)                        |
```

### A.2 交易广播流程

```
节点 A (create tx)                       节点 B/C/D (其他 peers)
   |                                        |
   | -- tx_broadcast {tx: {...}} --------->|
   |                                        |
   | (验证: signature, balance, nonce)    |
   | (加入 pending pool)                   |
   |                                        |
   | -- tx_broadcast {tx: {...}} --------->|  (继续广播)
   |                                        |
   | <-- tx_broadcast {tx: {...}} ---------|  (从其他 peer 收到)
   | (检查是否已存在)                       |
   | (如果新, 加入 pending pool)           |
```

### A.3 新区块通知

```
矿工节点 (挖到 block #151)              其他节点
   |                                        |
   | (mine block)                          |
   | (broadcast new_block)                 |
   | -- new_block {block: {...}} --------->|
   |                                        |
   | (验证区块)                             |
   | (追加到链)                             |
   | (发送 chain_update WS)                |
   | -- chain_update --> WebSocket clients|
```

---

## 附录 B: 错误处理

### 常见错误场景

| 场景 | 响应 | 动作 |
|------|------|------|
| 协议版本不匹配 | `error {code:1001, message:"Unsupported protocol"}` | 断开连接 |
| 交易签名无效 | `error {code:2001, message:"Invalid signature"}` | 丢弃，不广播 |
| 余额不足 | `error {code:2002, message:"Insufficient balance"}` | 丢弃，不广播 |
| 区块难度不满足 | `error {code:3001, message:"Difficulty too low"}` | 丢弃，记录恶意 |
| 消息 JSON 解析失败 | 直接断开 TCP 连接 | 记录日志 |
| 消息大小 > 10MB | `error {code:1003, message:"Message too large"}` | 断开连接 |
| 心跳超时 | 自动断开 | 清理资源 |

---

**文档结束**
