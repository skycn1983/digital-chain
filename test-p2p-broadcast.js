#!/usr/bin/env node

/**
 * P2P 网络交易广播测试
 * 测试交易从节点1发送到节点2，验证节点2是否收到
 */

const http = require('http');

const NODES = [
  { name: 'Node1', base: 'http://localhost:3000' },
  { name: 'Node2', base: 'http://localhost:3002' },
  { name: 'Node3', base: 'http://localhost:3004' }
];

function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('🧪 Testing P2P transaction broadcast...\n');

  // 1. 在每个节点创建钱包
  console.log('📝 Creating wallets on each node...');
  const wallets = {};
  for (const node of NODES) {
    const res = await request('POST', `${node.base}/wallet/create`);
    if (res.status === 200 && res.data.success) {
      wallets[node.name] = res.data;
      console.log(`  ${node.name}: ${res.data.address}`);
    } else {
      console.error(`  ${node.name}: failed`);
      return;
    }
  }

  // 2. 在 Node1 挖矿获得资金
  console.log('\n⛏️  Mining on Node1...');
  const minerAddr = wallets['Node1'].address;
  await request('POST', `${NODES[0].base}/mine`, { minerAddress: minerAddr });
  await sleep(1000);

  // 检查余额
  const bal1 = await request('GET', `${NODES[0].base}/balance/${minerAddr}`);
  console.log(`  Node1 balance: ${bal1.data.balance} OCT`);

  // 3. 发送交易从 Node1 到 Node2
  console.log('\n💸 Sending transaction from Node1 to Node2...');
  const tx = {
    from: wallets['Node1'].address,
    to: wallets['Node2'].address,
    amount: 10,
    privateKey: wallets['Node1'].privateKey
  };
  const txRes = await request('POST', `${NODES[0].base}/transaction`, tx);
  if (txRes.data.success) {
    console.log(`  ✓ Transaction sent: ${txRes.data.hash}`);
  } else {
    console.error(`  ✗ Transaction failed: ${txRes.data.error}`);
    return;
  }

  // 4. 等待广播
  await sleep(2000);

  // 5. 检查 Node2 是否收到交易（pending pool）
  console.log('\n🔍 Checking Node2 pending transactions...');
  const pending = await request('GET', `${NODES[1].base}/pending`);
  console.log(`  Node2 pending count: ${pending.data.count}`);
  if (pending.data.count > 0) {
    console.log(`  ✓ Transaction received via P2P!`);
    console.log(`    Tx hash: ${pending.data.transactions[0].hash}`);
  } else {
    console.log(`  ✗ Transaction not received`);
  }

  // 6. 挖矿确认交易
  console.log('\n⛏️  Mining on Node2 to confirm transaction...');
  await request('POST', `${NODES[1].base}/mine`, { minerAddress: wallets['Node2'].address });
  await sleep(1000);

  // 7. 检查最终余额
  console.log('\n📊 Final balances:');
  for (const node of NODES) {
    const addr = wallets[node.name].address;
    const bal = await request('GET', `${node.base}/balance/${addr}`);
    console.log(`  ${node.name} (${addr.substring(0,12)}...): ${bal.data.balance} OCT`);
  }

  console.log('\n✅ Test complete!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
