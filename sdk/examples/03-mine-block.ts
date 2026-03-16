/**
 * Example 3: Mine Blocks and View Chain Info
 * 
 * Usage: npx ts-node examples/03-mine-block.ts
 */

import { DigitalChainClient, Wallet } from '../src';

async function main() {
  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000'
  });

  try {
    // 健康检查
    const health = await client.health();
    console.log('🏗️  Initial state:');
    console.log('  Chain length:', health.chainLength);
    console.log('  Pending tx:', health.pendingTx);

    // 创建矿工钱包
    const miner = Wallet.generate();
    console.log('\n⛏️  Miner:', miner.address);

    // 挖矿 5 次
    console.log('\n⛏️  Starting mining...');
    for (let i = 0; i < 5; i++) {
      const block = await client.mineBlock(miner.address);
      console.log(`  Block #${block.index} mined: ${block.hash.substring(0, 16)}... (${block.transactions} txs)`);
    }

    // 查询链信息
    const chainInfo = await client.getChainInfo();
    console.log('\n📊 Chain Info:');
    console.log('  Total blocks:', chainInfo.blocks);
    console.log('  Pending transactions:', chainInfo.pending);
    console.log('  Difficulty:', chainInfo.difficulty);
    console.log('  Block reward:', chainInfo.reward, 'OCT');
    console.log('  Latest hash:', chainInfo.latestHash.substring(0, 20) + '...');

    // 查询矿工余额
    const balance = await client.getBalance(miner.address);
    console.log('\n💰 Miner balance:', balance, 'OCT');

    // 获取最新区块详情
    const latestBlock = await client.getBlock(chainInfo.blocks - 1);
    console.log('\n📦 Latest Block:');
    console.log('  Index:', latestBlock.index);
    console.log('  Hash:', latestBlock.hash.substring(0, 20) + '...');
    console.log('  Previous:', latestBlock.previousHash.substring(0, 20) + '...');
    console.log('  Transactions:', latestBlock.transactions.length);
    console.log('  Timestamp:', new Date(latestBlock.timestamp).toISOString());

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
