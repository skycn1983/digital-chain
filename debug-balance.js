#!/usr/bin/env node
const http = require('http');

function req(method, path, body) {
  return new Promise(resolve => {
    const url = new URL(path, 'http://localhost:3000');
    const start = Date.now();
    const r = http.request({ method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { 'Content-Type': 'application/json' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { d = JSON.parse(d); } catch(e) {}
        resolve({ status: res.statusCode, data: d, latency: Date.now() - start });
      });
    });
    r.on('error', e => resolve({ status: 0, data: { error: e.message }, latency: Date.now() - start }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  // 1. create wallet
  const w = await req('POST', '/wallet/create');
  const addr = w.data.address;
  console.log('Wallet:', addr);

  // 2. mine 5 blocks
  console.log('Mining 5 blocks...');
  for (let i = 0; i < 5; i++) {
    await req('POST', '/mine', { minerAddress: addr });
  }

  // 3. check balance
  const bal = await req('GET', `/balance/${addr}`);
  console.log('Balance after mining:', bal.data.balance);

  // 4. try send tx
  console.log('Sending tx...');
  const tx = await req('POST', '/transaction', {
    from: addr,
    to: '0x' + 'a'.repeat(40),
    amount: 1,
    gasPrice: 1,
    gasLimit: 21000,
    privateKey: w.data.privateKey
  });
  console.log('Tx result:', tx.status, tx.data);

  // 5. check pending
  const p = await req('GET', '/pending');
  console.log('Pending count:', p.data.count);
})().catch(console.error);
