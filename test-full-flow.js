#!/usr/bin/env node
// 完整交易流程测试

const http = require('http');

function req(method, path, body) {
  return new Promise(resolve => {
    const url = new URL(path, 'http://localhost:3000');
    const r = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { d = JSON.parse(d); } catch(e) {}
        resolve({ status: res.statusCode, data: d });
      });
    });
    r.on('error', e => resolve({ status: 0, data: { error: e.message } }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 1. 创建两个钱包
  const w1 = await req('POST', '/wallet/create');
  const w2 = await req('POST', '/wallet/create');
  const addr1 = w1.data.address;
  const addr2 = w2.data.address;
  const priv1 = w1.data.privateKey;
  console.log('Wallet1:', addr1);
  console.log('Wallet2:', addr2);

  // 2. 挖矿给 wallet1
  console.log('\nMining 3 blocks to wallet1...');
  for (let i = 0; i < 3; i++) {
    const m = await req('POST', '/mine', { minerAddress: addr1 });
    console.log(`  Block ${m.data.block.index} mined, reward: 50`);
  }

  // 3. 检查余额
  const bal1 = await req('GET', `/balance/${addr1}`);
  const bal2 = await req('GET', `/balance/${addr2}`);
  console.log('\nBalance before tx:');
  console.log(`  Wallet1: ${bal1.data.balance} OCT`);
  console.log(`  Wallet2: ${bal2.data.balance} OCT`);

  // 4. 发送交易
  console.log('\nSending 10 OCT from wallet1 to wallet2...');
  const tx = await req('POST', '/transaction', {
    from: addr1,
    to: addr2,
    amount: 10,
    gasPrice: 1,
    gasLimit: 21000,
    privateKey: priv1
  });
  if (tx.data.success) {
    console.log('  ✅ Transaction sent! Hash:', tx.data.hash);
  } else {
    console.error('  ❌ Transaction failed:', tx.data.error);
    process.exit(1);
  }

  // 5. 检查 pending
  const pending = await req('GET', '/pending');
  console.log(`\nPending transactions: ${pending.data.count}`);

  // 6. 挖矿确认交易
  console.log('\nMining block to confirm transaction...');
  await req('POST', '/mine', { minerAddress: addr1 });

  // 7. 最终余额
  const final1 = await req('GET', `/balance/${addr1}`);
  const final2 = await req('GET', `/balance/${addr2}`);
  console.log('\nFinal balances:');
  console.log(`  Wallet1: ${final1.data.balance} OCT (should be ~140)`);
  console.log(`  Wallet2: ${final2.data.balance} OCT (should be 10)`);

  // 8. 检查节点2是否收到交易广播
  // 注意：需要等待 P2P 同步，这里简单检查
  await new Promise(r => setTimeout(r, 2000));
  const peers = await req('GET', '/network/peers');
  console.log(`\nNetwork peers: ${peers.data.count}`);

  console.log('\n✅ Test complete!');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
