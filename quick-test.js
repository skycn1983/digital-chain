#!/usr/bin/env node
// 快速诊断交易失败原因

const http = require('http');

const NODE_URL = 'http://localhost:3000';

async function request(method, path, body = null) {
  return new Promise((resolve) => {
    const url = new URL(path, NODE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' }
    };
    const start = Date.now();
    const req = http.request(options, (res) => {
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

async function test() {
  // 创建钱包
  const wallet = await request('POST', '/wallet/create');
  console.log('Wallet:', wallet.data.address);

  // 挖矿
  await request('POST', '/mine', { minerAddress: wallet.data.address });
  const balance = await request('GET', `/balance/${wallet.data.address}`);
  console.log('Balance:', balance.data.balance);

  // 发送 3 笔交易
  for (let i = 0; i < 3; i++) {
    const tx = await request('POST', '/transaction', {
      from: wallet.data.address,
      to: '0x' + Math.random().toString(16).slice(2, 42).padEnd(40, '0'),
      amount: 1,
      gasPrice: 1,
      gasLimit: 21000,
      privateKey: wallet.data.privateKey
    });
    console.log(`Tx ${i+1}:`, tx.status, tx.data);
  }

  // 检查 pending
  const pending = await request('GET', '/pending');
  console.log('Pending count:', pending.data.count);
}

test().catch(console.error);
