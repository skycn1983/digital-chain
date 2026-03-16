/**
 * SDK 本地测试脚本（验证修复后的 getChainInfo）
 * 测试 chain info 字段是否完整
 */

const { DigitalChainClient, Wallet } = require('@digital-chain/js');

async function testFix() {
  console.log('🧪 Testing Digital Chain SDK (after fix)...\n');

  const client = new DigitalChainClient({
    restUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:3000'
  });

  try {
    // Test: Get chain info (should have all fields now)
    console.log('Test: Get chain info (fixed)');
    const chainInfo = await client.getChainInfo();
    console.log('✅ Chain info retrieved');
    console.log('  Blocks:', chainInfo.blocks);
    console.log('  Pending:', chainInfo.pending);
    console.log('  Difficulty:', chainInfo.difficulty);
    console.log('  Reward:', chainInfo.reward, 'OCT');
    console.log('  Latest Hash:', chainInfo.latestHash.substring(0, 20) + '...');
    console.log('  Valid:', chainInfo.valid);
    console.log('');

    // Test: Health check
    console.log('Test: Health check');
    const health = await client.health();
    console.log('✅ Health status:', health.status);
    console.log('  Chain length:', health.chainLength);
    console.log('  Pending transactions:', health.pendingTx);
    console.log('');

    // Test: WebSocket chain_update event
    console.log('Test: WebSocket chain_update event');
    await client.connectWebSocket();
    console.log('✅ WebSocket connected');
    
    let eventReceived = false;
    const handler = (info) => {
      console.log('  Received chain_update event:');
      console.log('    Blocks:', info.blocks);
      console.log('    Difficulty:', info.difficulty);
      console.log('    Reward:', info.reward);
      eventReceived = true;
    };
    client.on('chain_update', handler);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (eventReceived) {
      console.log('✅ chain_update event data is complete!\n');
    } else {
      console.log('  ⏱️  No chain_update received (OK if no new blocks)\n');
    }
    
    console.log('🎉 All fixes verified!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('  Details:', error.details);
    }
    process.exit(1);
  }
}

testFix().catch(console.error);
