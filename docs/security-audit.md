# 🔒 数字链安全审计报告（草案）

**日期**: 2026-03-16
**版本**: v1.1.0
**审计范围**: P2P 网络层、交易验证、钱包签名

---

## 📋 执行摘要

数字链核心功能已实现，P2P 网络层基础安全措施到位。发现若干中低风险问题，建议优先修复。

**总体风险评估**: 🟡 **中等** - 存在可被利用的漏洞（双重签名、交易池污染），需在测试网部署前修复。

---

## ✅ 安全控制（已实施）

| 控制项 | 状态 | 说明 |
|--------|------|------|
| 交易签名验证 | ✅ | 使用 secp256k1，公钥推导地址匹配 |
| P2P 握手认证 | ✅ | 节点 ID 基于公钥哈希，防篡改 |
| 交易池去重 | ✅ | LRU 缓存，防重放攻击 |
| 难度调整 | ✅ | 每区块调整，防 51% 攻击 |
| 交易 nonce 检查 | ⚠️ 部分 | 仅在 `handleTxBroadcast` 中验证，`/transaction` 端点未验证 |
| Gas 费检查 | ✅ | 最低交易金额和 Gas 费要求 |
| mDNS 发现 | ✅ | 局域网节点发现，无敏感信息泄露 |

---

## ⚠️ 发现的问题

### 1. 严重：Nonce 验证缺失（交易重放风险）
**位置**: `src/server.js` `/transaction` 端点
**描述**: 当用户通过 REST API 提交交易时，代码未验证 nonce（仅通过 `blockchain.getNonce(from)` 获取并设置，但不检查是否重复或跳跃）。
```javascript
// 当前代码
tx = new Transaction(from, to, amount, blockchain.getNonce(from), gasPrice, gasLimit);
tx.sign(wallet);
```
**风险**: 攻击者可以重复发送同一笔交易（相同 nonce），导致重复花费（如果余额足够）。
**影响**: 高 - 可能导致 double-spend
**推荐修复**:
```javascript
const expectedNonce = blockchain.getNonce(from);
if (tx.nonce !== expectedNonce) {
  return res.status(400).json({ error: `Invalid nonce: expected ${expectedNonce}, got ${tx.nonce}` });
}
```
**优先级**: 🔴 **高**

---

### 2. 中：交易池验证不足
**位置**: `src/p2p/broadcast/transaction-pool.js`
**描述**:
- `_validate` 仅检查金额、Gas、必填字段，未验证签名和公钥匹配
- `add` 方法不检查 nonce 和余额，依赖后续 `originalAddTransaction`
- 若 `originalAddTransaction` 失败，交易池残留无效交易，导致后续相同交易被误判为 duplicate

**风险**:
- 无效交易占用池子资源
- 合法交易因残留记录被拒绝

**推荐修复**:
- 在 `TransactionPool.add` 中增加 pre-validation（签名、公钥、nonce、余额预估）
- `originalAddTransaction` 失败时，从交易池移除对应交易

**优先级**: 🟡 **中**

---

### 3. 中：P2P 消息验证不完整
**位置**: `src/p2p/messages/index.js`
**描述**:
- `handleTxBroadcast` 验证了签名和公钥匹配，但 `handleBlocks` 和 `handleNewBlock` 对区块的验证仅检查 hash 和 difficulty，未验证 merkle root、coinbase 交易等
- 缺少对交易内部 nonce 的验证（依赖 `blockchain.addTransaction` 的 nonce 检查，但该检查在 P2P 路径中可能被绕过）

**风险**:
- 恶意节点发送无效区块，浪费验证资源
- 无效交易可能混入 pending pool

**推荐修复**:
- 在 `handleNewBlock` 中调用 `blockchain.isValid()` 完整验证
- 在 `handleTxBroadcast` 中增加 nonce 检查（与 `/transaction` 端点一致）

**优先级**: 🟡 **中**

---

### 4. 低：自连接导致资源浪费
**位置**: `src/server.js` P2P 初始化
**描述**: 如果种子节点包含本节点 P2P 地址，会建立到自己的连接，触发不必要的消息循环。
**影响**: 低 - 额外网络流量，可能触发 fork choice 日志警告
**推荐修复**:
```javascript
const localNodeId = p2p._getLocalNodeId();
const filteredSeeds = seedNodes.filter(addr => {
  // 解析地址端口，与 p2p.port 比较
  const port = parseInt(addr.split(':')[1]);
  return port !== p2p.port;
});
```
**优先级**: 🟢 **低**

---

### 5. 低：缺乏身份认证
**位置**: 所有 REST 和 P2P 端点
**描述**: 任何节点均可连接、提交交易、查询链数据。生产环境需要节点白名单或 proof-of-work 挑战。
**影响**: 低 - 测试网无妨，主网需身份机制
**推荐**: 实施节点证书或 token 认证

**优先级**: 🟢 **低**（测试网可接受）

---

## 🛡️ 安全建议（加固）

### 1. 交易验证流程标准化
所有交易入口（REST `/transaction` 和 P2P `tx_broadcast`）应使用相同的验证函数，确保：
- nonce 正确且递增
- 余额充足（考虑 pending 中同名交易）
- 签名有效且公钥匹配 from 地址
- Gas 费足够

建议将验证逻辑提取到 `blockchain.validateTransaction(tx)` 方法，供各调用点使用。

---

### 2. 交易池原子操作
在 `blockchain.addTransaction` 钩子中：
1. `transactionPool.add(tx)` 成功
2. `originalAddTransaction(tx)` 成功
3. 两者都成功才广播；任一失败则回滚（从池中移除）

当前实现：若第2步失败，池中残留无效交易。

---

### 3. P2P 消息限流与惩罚
- 对连续发送无效消息的 peer 实施临时 ban
- 限制每个 IP 的连接数
- 实现 reputation 系统

---

### 4. 加密与密钥管理
- 私钥不应通过 REST 响应返回（当前 `/wallet/create` 返回 privateKey，仅限测试）
- 生产环境使用 BIP39 助记词，客户端签名
- 考虑 HD 钱包支持

---

### 5. 审计日志
- 记录所有失败验证尝试（签名无效、nonce 错误等）
- 记录 P2P 连接和断开
- 实现日志轮转和防篡改

---

## 📊 威胁模型

| 威胁 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 双重签名 | 中 | 高 | nonce 严格递增验证 |
| 交易池耗尽攻击 | 低 | 中 | LRU 大小限制、最小 Gas 费 |
| 女巫攻击（大量节点） | 中 | 低 | 节点身份认证（未来） |
| 时间戳操纵 | 低 | 低 | 区块时间戳范围检查 |
| 长程攻击 | 低 | 高 | 检查点机制（未来） |
| 内存耗尽（大区块） | 低 | 中 | 区块大小限制（当前无，需添加） |
| 数据包分割/粘包攻击 | 低 | 低 | MessageReader 长度前缀已防护 |

---

## 🧪 测试覆盖

| 测试类型 | 覆盖 | 说明 |
|----------|------|------|
| 单元测试 | 🟡 部分 | 核心类有测试，边缘 case 不足 |
| 集成测试 | 🟡 部分 | P2P 网络测试通过，但异常流程未覆盖 |
| 模糊测试 | ❌ 无 | 未进行 |
| 安全测试 | ❌ 无 | 签名伪造、重放等未测试 |

**建议**: 添加 fuzzing 测试，特别是消息解码和交易验证。

---

## 🎯 修复优先级

1. **🔴 高**: 修复 nonce 验证缺失（REST 端点）
2. **🟡 中**: 交易池原子操作与验证增强
3. **🟡 中**: P2P 区块验证完整性
4. **🟢 低**: 防止自连接
5. **🟢 低**: 添加审计日志

---

## 📝 结论

数字链基础安全架构合理，但需在测试网部署前修复 nonce 验证和交易池一致性问题。P2P 网络层已具备消息加密传输（TCP）和基础验证，适合测试环境。

建议在下一开发周期投入安全加固，并在主网启动前进行第三方安全审计。

---

**报告生成时间**: 2026-03-16 21:40 GMT+8
**下次审计**: 主网上线前（预计 2026-04）
