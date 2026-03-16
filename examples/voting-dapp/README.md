# 投票 DApp - 去中心化投票示例

## 功能
- 创建投票提案
- 对提案投票（赞成/反对）
- 查询提案详情和投票结果
- 实时统计（通过链上数据）

## 设计说明

由于数字链当前版本未提供智能合约，本 DApp 使用以下约定：

- **投票系统地址**: `0x564f494e475f434f4e5452414354` (固定，模拟合约)
- **创建提案**: 发送一笔交易到投票系统地址，payload 包含提案标题、描述、截止时间
- **投票**: 发送交易到提案地址（提案创建后返回的地址），payload 包含投票选择（1=赞成, 0=反对）
- **查询**: 扫描链上交易，解析投票数据

## 安装
```bash
npm install @digital-chain/js
```

## 使用方法

### 1. 创建提案
```bash
node voting-dapp.js create-proposal \
  --title "升级协议至 v2.0" \
  --description "是否同意将网络协议升级至 v2.0，包含新功能 XYZ" \
  --duration 86400 \
  --creator 0xYourAddress \
  --privateKey yourPrivateKey
```
输出：提案地址（用于投票）

### 2. 投票
```bash
node voting-dapp.js vote \
  --proposal 0xProposalAddress \
  --choice 1 \
  --voter 0xYourAddress \
  --privateKey yourPrivateKey
```

### 3. 查询提案
```bash
node voting-dapp.js get-proposal --proposal 0xProposalAddress
```

### 4. 列出所有提案
```bash
node voting-dapp.js list-proposals
```

## 示例

```bash
# 创建提案（1天投票期）
node voting-dapp.js create-proposal \
  --title "增加区块奖励" \
  --description "是否将区块奖励从 50 OCT 提高到 75 OCT？" \
  --duration 86400 \
  --creator 0xAlice \
  --privateKey alicePrivateKey

# 投票赞成
node voting-dapp.js vote \
  --proposal 0xProposalAddr \
  --choice 1 \
  --voter 0xBob \
  --privateKey bobPrivateKey

# 查询提案
node voting-dapp.js get-proposal --proposal 0xProposalAddr
```

## 数据结构

### 提案交易 (from → voting system)
```json
{
  "type": "create_proposal",
  "title": "string",
  "description": "string",
  "duration": number, // seconds
  "endBlock": number  // 计算的截止区块高度
}
```

### 投票交易 (from → proposal address)
```json
{
  "type": "vote",
  "proposalId": "string",
  "choice": 1 // 1=赞成, 0=反对
}
```

## 注意事项
- 提案创建需要支付交易费
- 每人每提案只能投票一次（基于 nonce 和地址）
- 投票截止后不再计票
- 结果需客户端解析链上数据

## 故障排除
- **提案地址无效**: 确保交易已确认，提案创建成功
- **重复投票**: 同一地址不能重复投票
- **投票未统计**: 检查提案是否已过期，交易是否已确认
