/**
 * SDK 本地测试脚本 (CommonJS)
 * 验证 SDK 基本功能
 */

const { DigitalChainClient, Wallet } = require('@digital-chain/js');

async function testSDK() {
  console.log('🧪 Testing Digital Chain SDK...\n');

  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000'
  });

  try {
    // Test 1: Create wallet
    console.log('Test 1: Create wallet');
    const wallet = client.createWallet();
    console.log('✅ Wallet created:', wallet.address.substring(0, 20) + '...');
    console.log('  Public Key:', wallet.publicKey.substring(0, 30) + '...');
    console.log('  Can sign:', wallet.canSign());
    console.log('');

    // Test 2: Get chain health
    console.log('Test 2: Health check');
    const health = await client.health();
    console.log('✅ Chain status:', health.status);
    console.log('  Blocks:', health.chainLength);
    console.log('  Pending:', health.pendingTx);
    console.log('');

    // Test 3: Get chain info
    console.log('Test 3: Get chain info');
    const chainInfo = await client.getChainInfo();
    console.log('✅ Chain info retrieved');
    console.log('  Total blocks:', chainInfo.blocks);
    console.log('  Difficulty:', chainInfo.difficulty);
    console.log('  Reward:', chainInfo.reward, 'OCT');
    console.log('');

    // Test 4: Get balance (should be 0 for new wallet)
    console.log('Test 4: Get balance');
    const balance = await client.getBalance(wallet.address);
    console.log('✅ Balance:', balance, 'OCT');
    console.log('');

    // Test 5: Mine blocks to get funds
    console.log('Test 5: Mine blocks');
    console.log('⛏️  Mining 2 blocks...');
    await client.mineBlock(wallet.address);
    await client.mineBlock(wallet.address);
    console.log('✅ Mined 2 blocks');
    console.log('');

    // Test 6: Check balance after mining
    console.log('Test 6: Balance after mining');
    const newBalance = await client.getBalance(wallet.address);
    console.log('✅ New balance:', newBalance, 'OCT');
    console.log('');

    // Test 7: Create and send transaction
    console.log('Test 7: Send transaction');
    const recipient = Wallet.generate();
    console.log('  Recipient:', recipient.address.substring(0, 20) + '...');

    const txResult = await client.sendTransaction({
      from: wallet.address,
      to: recipient.address,
      amount: 10,
      privateKey: wallet.exportPrivateKey()
    });
    console.log('✅ Transaction sent');
    console.log('  Hash:', txResult.hash.substring(0, 20) + '...');
    console.log('  Nonce:', txResult.nonce);
    console.log('');

    // Test 8: Mine to confirm transaction
    console.log('Test 8: Confirm transaction');
    await client.mineBlock(wallet.address);
    console.log('✅ Block mined');
    console.log('');

    // Test 9: Check balances after transaction
    console.log('Test 9: Final balances');
    const senderBalance = await client.getBalance(wallet.address);
    const recipientBalance = await client.getBalance(recipient.address);
    console.log('✅ Sender balance:', senderBalance, 'OCT');
    console.log('  Recipient balance:', recipientBalance, 'OCT');
    console.log('');

    // Test 10: WebSocket connection
    console.log('Test 10: WebSocket connection');
    await client.connectWebSocket();
    console.log('✅ WebSocket connected');
    
    // Subscribe to events
    let eventReceived = false;
    const handler = (info) => {
      console.log('  Received chain_update event, height:', info.blocks);
      eventReceived = true;
    };
    client.on('chain_update', handler);
    
    // Wait a bit for any events
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!eventReceived) {
      console.log('  ⏱️  No chain_update received (OK if no new blocks)');
    }
    
    console.log('✅ WebSocket test completed\n');

    console.log('🎉 All SDK tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('  Details:', error.details);
    }
    process.exit(1);
  }
}

testSDK().catch(console.error);
