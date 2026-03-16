# 代币转账 DApp - 使用说明

## 功能
- 创建钱包
- 查询余额
- 发送代币 (OCT)
- 查看交易状态

## 前置要求
- Node.js 18+
- 数字链节点运行（默认 http://localhost:3000）
- `@digital-chain/js` SDK 已安装（或使用本地链接）

## 安装
```bash
npm install @digital-chain/js
```

## 使用方法

### 1. 创建钱包
```bash
node transfer-dapp.js create-wallet
```
输出：地址和私钥（私钥请妥善保存）

### 2. 查询余额
```bash
node transfer-dapp.js balance --address 0xYourAddress
```

### 3. 发送代币
```bash
node transfer-dapp.js send \
  --from 0xYourAddress \
  --to 0xRecipientAddress \
  --amount 10 \
  --privateKey yourPrivateKey
```

### 4. 挖矿（如果余额不足）
```bash
node transfer-dapp.js mine --miner-address 0xYourAddress
```

## 示例工作流

```bash
# 1. 创建两个钱包
node transfer-dapp.js create-wallet > wallet1.json
node transfer-dapp.js create-wallet > wallet2.json

# 2. 为钱包1挖矿获取OCT
node transfer-dapp.js mine --miner-address $(cat wallet1.json | jq -r .address)

# 3. 查询余额
node transfer-dapp.js balance --address $(cat wallet1.json | jq -r .address)

# 4. 转账到钱包2
node transfer-dapp.js send \
  --from $(cat wallet1.json | jq -r .address) \
  --to $(cat wallet2.json | jq -r .address) \
  --amount 10 \
  --privateKey $(cat wallet1.json | jq -r .privateKey)

# 5. 查询钱包2余额
node transfer-dapp.js balance --address $(cat wallet2.json | jq -r .address)
```

## 安全提示
- 切勿在生产环境硬编码私钥
- 使用环境变量或密钥管理服务
- 测试网使用，主网需额外安全措施

## 故障排除
- **交易被拒绝**: 检查余额、nonce、Gas费
- **连接失败**: 确认节点运行在指定端口
- **签名错误**: 私钥与发送地址不匹配
