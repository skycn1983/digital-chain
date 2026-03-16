/**
 * Example 5: Query Balance and Transaction History
 * 
 * Usage: npx ts-node examples/05-query-balance.ts
 */

import { DigitalChainClient, Wallet } from '../src';

async function main() {
  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000'
  });

  try {
    // 查询完整链状态
    console.log('📊 Fetching full chain info...\n');
    const chainInfo = await client.getChainInfo();
    
    console.log('🏗️  Chain Status:');
    console.log('  Total blocks:', chainInfo.blocks);
    console.log('  Valid:', chainInfo.valid ? '✅' : '❌');
    console.log('  Difficulty:', chainInfo.difficulty);
    console.log('  Block reward:', chainInfo.reward, 'OCT');
    console.log('  Pending transactions:', chainInfo.pending);
    console.log('  Latest hash:', chainInfo.latestHash.substring(0, 20) + '...');

    // 创建几个钱包用于演示
    const wallets = [
      { name: 'Alice', wallet: Wallet.generate() },
      { name: 'Bob', wallet: Wallet.generate() },
      { name: 'Charlie', wallet: Wallet.generate() }
    ];

    console.log('\n👤 Created test wallets:');
    for (const { name, wallet } of wallets) {
      console.log(`  ${name}: ${wallet.address.substring(0, 20)}...`);
    }

    // 查询所有钱包余额
    console.log('\n💰 Balances:');
    for (const { name, wallet } of wallets) {
      const balance = await client.getBalance(wallet.address);
      console.log(`  ${name}: ${balance} OCT`);
    }

    // 查询待处理交易
    if (chainInfo.pending > 0) {
      console.log('\n⏳ Pending transactions:');
      const pending = await client.getPendingTransactions();
      for (const tx of pending) {
        console.log(`  ${tx.hash.substring(0, 12)}...: ${tx.from.substring(0, 10)}... → ${tx.to.substring(0, 10)}... : ${tx.amount} OCT`);
      }
    } else {
      console.log('\n✅ No pending transactions');
    }

    // 查询最新区块详情
    console.log('\n📦 Latest Block Details:');
    const latestBlock = await client.getBlock(chainInfo.blocks - 1);
    console.log(`  Index: ${latestBlock.index}`);
    console.log(`  Hash: ${latestBlock.hash}`);
    console.log(`  Timestamp: ${new Date(latestBlock.timestamp).toISOString()}`);
    console.log(`  Transactions: ${latestBlock.transactions.length}`);
    console.log(`  Merkle Root: ${latestBlock.merkleRoot.substring(0, 20)}...`);

    // 显示区块中的交易（最多 5 笔）
    if (latestBlock.transactions.length > 0) {
      console.log('\n  Transactions in this block:');
      for (let i = 0; i < Math.min(5, latestBlock.transactions.length); i++) {
        const tx = latestBlock.transactions[i];
        const type = tx.from === '0x0000000000000000000000000000000000000000' ? 'Coinbase' : 'Transfer';
        console.log(`    ${i + 1}. [${type}] ${tx.from.substring(0, 10)}... → ${tx.to.substring(0, 10)}... : ${tx.amount} OCT`);
      }
      if (latestBlock.transactions.length > 5) {
        console.log(`    ... and ${latestBlock.transactions.length - 5} more`);
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) console.error('Details:', error.details);
  }
}

main();
