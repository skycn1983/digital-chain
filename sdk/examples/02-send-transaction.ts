/**
 * Example 2: Send Transaction
 * 
 * Usage: npx ts-node examples/02-send-transaction.ts
 */

import { DigitalChainClient, Wallet } from '../src';

async function main() {
  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000'
  });

  try {
    // 创建两个钱包
    const alice = Wallet.generate();
    const bob = Wallet.generate();

    console.log('👤 Alice:', alice.address);
    console.log('👤 Bob:', bob.address);

    // 为 Alice 挖矿获得资金（测试网）
    console.log('\n⛏️  Mining blocks to fund Alice...');
    await client.mineBlock(alice.address);
    await client.mineBlock(alice.address);
    await client.mineBlock(alice.address);

    // 查询余额
    let balance = await client.getBalance(alice.address);
    console.log('💰 Alice balance:', balance, 'OCT');

    // 发送交易
    console.log('\n💸 Sending 50 OCT from Alice to Bob...');
    const result = await client.sendTransaction({
      from: alice.address,
      to: bob.address,
      amount: 50,
      privateKey: alice.exportPrivateKey()
    });

    console.log('✅ Transaction sent!');
    console.log('  Hash:', result.hash);
    console.log('  Nonce:', result.nonce);

    // 挖矿确认交易
    console.log('\n⛏️  Mining to confirm transaction...');
    await client.mineBlock(alice.address);

    // 检查余额变化
    const aliceBalance = await client.getBalance(alice.address);
    const bobBalance = await client.getBalance(bob.address);

    console.log('\n📊 Updated Balances:');
    console.log('  Alice:', aliceBalance, 'OCT');
    console.log('  Bob:', bobBalance, 'OCT');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) console.error('Details:', error.details);
  }
}

main();
