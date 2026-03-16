/**
 * Example 1: Create Wallet and Check Balance
 * 
 * Usage: npx ts-node examples/01-create-wallet.ts
 */

import { DigitalChainClient } from '../src';

async function main() {
  // 创建客户端
  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000'
  });

  try {
    // 创建新钱包
    const wallet = client.createWallet();
    console.log('✅ Wallet created');
    console.log('  Address:', wallet.address);
    console.log('  Public Key:', wallet.publicKey.substring(0, 40) + '...');
    
    // 导出私钥（仅测试环境！）
    const privateKey = wallet.exportPrivateKey();
    console.log('  Private Key:', privateKey.substring(0, 20) + '...');

    // 查询余额（新钱包余额为 0）
    const balance = await client.getBalance(wallet.address);
    console.log('  Balance:', balance, 'OCT');

    // 健康检查
    const health = await client.health();
    console.log('\n📊 Chain Status:');
    console.log('  Blocks:', health.chainLength);
    console.log('  Pending:', health.pendingTx);
    console.log('  Status:', health.status);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

main();
