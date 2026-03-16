/**
 * Example 4: WebSocket Real-time Subscription
 * 
 * Usage: npx ts-node examples/04-websocket-subscribe.ts
 */

import { DigitalChainClient } from '../src';

async function main() {
  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000'
  });

  try {
    // 连接 WebSocket
    console.log('🔌 Connecting to WebSocket...');
    await client.connectWebSocket();
    console.log('✅ WebSocket connected\n');

    // 订阅链更新
    client.on('chain_update', (info) => {
      console.log(`[CHAIN UPDATE] Height: ${info.blocks}, Pending: ${info.pending}, Valid: ${info.valid}`);
    });

    // 订阅新区块
    client.on('new_block', (block) => {
      console.log(`[NEW BLOCK] #${block.index} by ${block.transactions.length} txs, hash: ${block.hash.substring(0, 16)}...`);
      
      // 显示交易摘要
      for (const tx of block.transactions.slice(0, 3)) {
        console.log(`  - ${tx.from.substring(0, 10)}... → ${tx.to.substring(0, 10)}... : ${tx.amount} OCT`);
      }
      if (block.transactions.length > 3) {
        console.log(`  ... and ${block.transactions.length - 3} more`);
      }
    });

    // 订阅新交易
    client.on('new_transaction', (tx) => {
      console.log(`[NEW TX] ${tx.from.substring(0, 10)}... → ${tx.to.substring(0, 10)}... : ${tx.amount} OCT (hash: ${tx.hash.substring(0, 12)}...)`);
    });

    console.log('👂 Listening for events... (Press Ctrl+C to stop)\n');

    // 保持运行，观察事件
    // 可以同时发送一些交易来触发事件
    setTimeout(() => {
      console.log('\n💡 Tip: Open another terminal and run example 02-send-transaction.ts to see events!');
    }, 2000);

    // 保持进程运行
    await new Promise(() => {}); // 永久等待

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  process.exit(0);
});

main();
