#!/usr/bin/env node
// 简化的性能测试（同步风格）

const http = require('http');

const NODE_URL = 'http://localhost:3000';
const CONCURRENT = 5;
const TOTAL_TX = 20;

function request(method, path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, NODE_URL);
    const start = Date.now();
    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, data: parsed, latency: Date.now() - start });
      });
    });
    req.on('error', (err) => resolve({ status: 0, data: { error: err.message }, latency: Date.now() - start }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('🧪 Simple Performance Test');
  console.log(`   Concurrency: ${CONCURRENT}, Total: ${TOTAL_TX}`);

  // 1. 创建钱包
  const walletRes = await request('POST', '/wallet/create');
  const wallet = walletRes.data;
  console.log('Wallet:', wallet.address);

  // 2. 挖矿
  console.log('Mining 10 blocks...');
  for (let i = 0; i < 10; i++) {
    await request('POST', '/mine', { minerAddress: wallet.address });
  }
  const bal = await request('GET', `/balance/${wallet.address}`);
  console.log('Balance:', bal.data.balance, 'OCT');

  // 3. 发送交易（串行先测 3 笔）
  console.log('\nSending 3 sequential transactions...');
  for (let i = 0; i < 3; i++) {
    const tx = await request('POST', '/transaction', {
      from: wallet.address,
      to: '0x' + Math.random().toString(16).slice(2, 42).padEnd(40, '0'),
      amount: 1,
      gasPrice: 1,
      gasLimit: 21000,
      privateKey: wallet.privateKey
    });
    console.log(`  Tx ${i+1}: ${tx.status}, success=${tx.data.success}, latency=${tx.latency}ms`);
    if (!tx.data.success) console.error('    Error:', tx.data.error || tx.data);
  }

  // 4. 检查 pending
  const pending = await request('GET', '/pending');
  console.log('Pending count:', pending.data.count);

  console.log('\n✅ Test complete');
})().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
