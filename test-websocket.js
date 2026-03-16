#!/usr/bin/env node

/**
 * WebSocket 功能测试脚本
 * 测试：连接、接收 new_transaction、new_block、chain_update 事件
 */

const WebSocket = require('ws');

const wsUrl = 'ws://localhost:3000';
console.log(`🔗 连接到 WebSocket: ${wsUrl}`);

const ws = new WebSocket(wsUrl);
const wallet1 = null;
const wallet2 = null;

ws.on('open', () => {
  console.log('✅ WebSocket 连接成功\n');
  console.log('📋 测试步骤:');
  console.log('1. 创建两个钱包');
  console.log('2. 发送交易');
  console.log('3. 挖矿');
  console.log('4. 观察实时事件\n');
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data);
    const { type, data: payload } = msg;
    
    switch (type) {
      case 'chain_update':
        console.log(`📊 [链更新] 高度: ${payload.stats.blocks}, 难度: ${payload.stats.difficulty}, 待处理: ${payload.stats.pending}`);
        break;
      case 'new_transaction':
        console.log(`💸 [新交易] ${payload.from.substring(0,10)}... → ${payload.to.substring(0,10)}... 金额: ${payload.amount} OCT`);
        break;
      case 'new_block':
        console.log(`⛏️  [新区块] #${payload.index} 哈希: ${payload.hash.substring(0,16)}... 奖励: ${payload.reward} OCT 交易数: ${payload.transactions.length}`);
        break;
      default:
        console.log(`📨 [未知事件] ${type}:`, JSON.stringify(payload).substring(0,100));
    }
  } catch (e) {
    console.error('解析消息失败:', e.message);
  }
});

ws.on('close', () => {
  console.log('\n❌ WebSocket 连接关闭');
});

ws.on('error', (err) => {
  console.error('❌ WebSocket 错误:', err.message);
});

// 模拟测试流程
setTimeout(async () => {
  console.log('--- 开始测试 ---\n');
  
  // 1. 创建钱包
  console.log('1️⃣ 创建钱包 A (矿工)...');
  const res1 = await fetch('http://localhost:3000/wallet/create', { method: 'POST' });
  const walletA = await res1.json();
  console.log(`   地址: ${walletA.address}`);
  
  console.log('2️⃣ 创建钱包 B...');
  const res2 = await fetch('http://localhost:3000/wallet/create', { method: 'POST' });
  const walletB = await res2.json();
  console.log(`   地址: ${walletB.address}\n`);
  
  // 2. 先给钱包 A 挖矿获得代币
  console.log('3️⃣ 为钱包 A 挖矿 (获得初始代币)...');
  await fetch('http://localhost:3000/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minerAddress: walletA.address })
  });
  await new Promise(resolve => setTimeout(resolve, 1500)); // 等待事件传播
  
  // 3. 发送交易
  console.log('\n4️⃣ 发送交易 (A → B, 30 OCT)...');
  await fetch('http://localhost:3000/transaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: walletA.address,
      to: walletB.address,
      amount: 30
    })
  });
  await new Promise(resolve => setTimeout(resolve, 1000)); // 等待交易进入池
  
  // 4. 挖矿
  console.log('\n5️⃣ 再次挖矿 (确认交易)...');
  await fetch('http://localhost:3000/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ minerAddress: walletA.address })
  });
  
  // 等待事件传播
  setTimeout(() => {
    console.log('\n--- 测试完成 ---');
    console.log('✅ 请检查上方是否收到实时事件');
    console.log('预期事件顺序:');
    console.log('  - new_transaction (交易创建)');
    console.log('  - new_block (区块挖出)');
    console.log('  - chain_update (链状态更新 x2)');
    ws.close();
    process.exit(0);
  }, 3000);
}, 1000);

// 60秒超时
setTimeout(() => {
  console.log('⏰ 测试超时');
  ws.close();
  process.exit(1);
}, 60000);
