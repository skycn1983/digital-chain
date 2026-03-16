#!/usr/bin/env node

/**
 * 示例 2: 发送交易
 * 
 * 演示如何创建、签名和发送交易
 * 注意：当前演示模式跳过完整签名验证
 */

const { Wallet } = require('../src/crypto');
const { Transaction } = require('../src/transaction');

console.log('💸 交易发送示例\n');

// 假设我们有两个钱包（实际应从区块链查询余额和Nonce）
const sender = new Wallet(); // 实际应用中应从私钥导入
const receiver = new Wallet();

console.log('发送方:', sender.address);
console.log('接收方:', receiver.address);

// 创建交易
const amount = 50;
const nonce = 0; // 实际应从区块链查询: GET /nonce/:address
const gasPrice = 1;
const gasLimit = 21000;

console.log(`\n创建交易: ${amount} OCT (nonce=${nonce})`);

const tx = new Transaction(
  sender.address,
  receiver.address,
  amount,
  nonce,
  gasPrice,
  gasLimit
);

// 签名交易（生产环境必需）
// const signature = tx.sign(sender);
// console.log('签名:', signature.substring(0, 20) + '...');

// 计算交易哈希
const txHash = tx.getHash();
console.log('交易哈希:', txHash);

// 计算费用
const fee = tx.getFee();
console.log(`交易费用: ${fee} OCT (gasPrice ${gasPrice} × gasLimit ${gasLimit})`);

console.log('\n✅ 交易对象已创建');
console.log('📤 接下来: POST /transaction 提交到节点');

// 实际发送示例（需要运行节点）：
/*
fetch('http://localhost:3000/transaction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from: sender.address,
    to: receiver.address,
    amount: amount
  })
}).then(res => res.json()).then(data => {
  console.log('\n响应:', data);
});
*/
