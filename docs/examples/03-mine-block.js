#!/usr/bin/env node

/**
 * 示例 3: 挖矿
 * 
 * 演示如何执行PoW挖矿，打包交易并生成新区块
 */

const { Blockchain } = require('../src/blockchain');
const { Wallet } = require('../src/crypto');

console.log('⛏️  挖矿示例\n');

// 创建区块链实例（自动加载或创建创世区块）
const blockchain = new Blockchain();

console.log('链高度:', blockchain.chain.length);
console.log('当前难度:', blockchain.difficulty);
console.log('出块奖励:', blockchain.blockReward, 'OCT');

// 创建矿工钱包
const miner = new Wallet();
console.log('\n矿工地址:', miner.address);

// 先创建一些待处理交易
console.log('\n📦 模拟添加待处理交易...');
for (let i = 0; i < 3; i++) {
  const sender = new Wallet();
  const receiver = new Wallet();
  
  // 注意：实际需要先给sender挖矿获得余额
  // 这里仅演示交易结构
  const tx = {
    from: sender.address,
    to: receiver.address,
    amount: 10,
    nonce: 0
  };
  console.log(`  交易 ${i+1}: ${sender.address.substring(0,10)}... → ${receiver.address.substring(0,10)}... (10 OCT)`);
}

console.log('\n🚀 开始挖矿...');
console.log('这可能需要几秒到几分钟，取决于难度和CPU性能...\n');

// 执行挖矿
const startTime = Date.now();
const block = blockchain.mineBlock(miner.address);
const duration = (Date.now() - startTime) / 1000;

console.log('✅ 区块挖出成功!');
console.log('区块高度:', block.index);
console.log('区块哈希:', block.hash);
console.log('包含交易数:', block.transactions.length);
console.log('挖矿耗时:', duration.toFixed(3), '秒');
console.log('矿工奖励:', blockchain.blockReward, 'OCT');

// 链状态
const stats = blockchain.getStats();
console.log('\n📊 更新后的链状态:');
console.log('总区块数:', stats.blocks);
console.log('待处理交易:', stats.pending);
console.log('最新哈希:', stats.latestHash.substring(0, 20) + '...');
console.log('链有效:', stats.valid ? '✅' : '❌');

console.log('\n💡 提示:');
console.log('1. 实际使用中，交易需要先通过 POST /transaction 提交');
console.log('2. 挖矿会打包所有待处理交易 + Coinbase 奖励');
console.log('3. 难度每10个区块自动调整一次');
