#!/usr/bin/env node

/**
 * 示例 4: WebSocket 实时订阅
 * 
 * 演示如何连接 WebSocket 并监听链上事件
 */

const WebSocket = require('ws');

const wsUrl = 'ws://localhost:3000';
console.log(`🔗 连接到 WebSocket: ${wsUrl}\n`);

const ws = new WebSocket(wsUrl);

let eventCount = 0;
const startTime = Date.now();

ws.on('open', () => {
  console.log('✅ 连接成功！等待事件...\n');
  console.log('事件类型:');
  console.log('  - chain_update: 链状态更新（连接时+每个新区块）');
  console.log('  - new_block: 新区块挖出');
  console.log('  - new_transaction: 新交易创建\n');
  console.log('--- 事件日志 ---\n');
});

ws.on('message', (data) => {
  eventCount++;
  try {
    const msg = JSON.parse(data);
    const { type, data: payload } = msg;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    switch (type) {
      case 'chain_update':
        console.log(`[${elapsed}s] 📊 chain_update | 高度: ${payload.stats.blocks}, 难度: ${payload.stats.difficulty}, 待处理: ${payload.stats.pending}`);
        break;
        
      case 'new_block':
        console.log(`[${elapsed}s] ⛏️  new_block    | #${payload.index} 哈希: ${payload.hash.substring(0,16)}... 奖励: ${payload.reward} OCT 交易: ${payload.transactions.length}`);
        break;
        
      case 'new_transaction':
        console.log(`[${elapsed}s] 💸 new_tx       | ${payload.from.substring(0,10)}... → ${payload.to.substring(0,10)}... 金额: ${payload.amount} OCT`);
        break;
        
      default:
        console.log(`[${elapsed}s] ❓ unknown     | ${type}`);
    }
  } catch (e) {
    console.error('解析消息失败:', e.message);
  }
});

ws.on('close', () => {
  console.log('\n❌ 连接关闭');
  console.log(`总计接收事件: ${eventCount}`);
  console.log('5秒后尝试重连...');
  setTimeout(() => {
    console.log('\n🔄 重新连接...\n');
    new WebSocket(wsUrl); // 递归创建新连接
  }, 5000);
});

ws.on('error', (err) => {
  console.error('❌ WebSocket 错误:', err.message);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n👋 退出...');
  ws.close();
  process.exit(0);
});

console.log('💡 提示:');
console.log('- 在一个终端运行此脚本: node 04-websocket-subscribe.js');
console.log('- 在另一个终端执行操作: 创建交易、挖矿等');
console.log('- 观察此终端实时事件输出');
console.log('- 按 Ctrl+C 退出\n');
