#!/usr/bin/env node

/**
 * Digital Chain 性能基准测试
 * 测量吞吐量 (TPS) 和延迟
 */

const http = require('http');
const { v4: uuidv4 } = require('uuid');

const NODE_URL = process.env.NODE_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT) || 10;
const TOTAL_TRANSACTIONS = parseInt(process.env.TOTAL_TX) || 100;

// 简单 UUID 模拟（避免依赖 uuid 包）
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, NODE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          data: parsed,
          latency: Date.now() - start
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function benchmark() {
  console.log(`🚀 Digital Chain Performance Benchmark`);
  console.log(`   Node: ${NODE_URL}`);
  console.log(`   Concurrent requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Total transactions: ${TOTAL_TRANSACTIONS}`);
  console.log('');

  // 1. 准备：创建钱包并挖矿获取资金
  console.log('📝 Setup: Creating wallet and mining...');
  const walletRes = await request('POST', '/wallet/create');
  const wallet = walletRes.data;
  console.log(`   Wallet: ${wallet.address}`);

  // 挖足够多的块
  const blocksToMine = Math.ceil(TOTAL_TRANSACTIONS / 10) + 5;
  console.log(`   Mining ${blocksToMine} blocks to fund wallet...`);
  for (let i = 0; i < blocksToMine; i++) {
    await request('POST', '/mine', { minerAddress: wallet.address });
  }

  // 确认余额
  const balanceRes = await request('GET', `/balance/${wallet.address}`);
  const balance = balanceRes.data.balance;
  console.log(`   Balance: ${balance} OCT`);
  console.log('');

  if (balance < TOTAL_TRANSACTIONS) {
    console.error(`❌ Insufficient balance (${balance} OCT) for ${TOTAL_TRANSACTIONS} transactions`);
    process.exit(1);
  }

  // 2. 基准测试：发送交易
  console.log(`🏃 Running benchmark: ${TOTAL_TRANSACTIONS} transactions, ${CONCURRENT_REQUESTS} concurrent...`);

  const txHashes = [];
  const latencies = [];
  let startTime, endTime;

  // 使用信号量控制并发
  const semaphore = new Array(CONCURRENT_REQUESTS).fill(Promise.resolve());

  async function runWithSemaphore(task) {
    const queue = semaphore.shift();
    const result = queue.then(() => task()).finally(() => {
      semaphore.push(Promise.resolve());
    });
    return result;
  }

  // 创建一批交易
  const tasks = [];
  for (let i = 0; i < TOTAL_TRANSACTIONS; i++) {
    tasks.push(runWithSemaphore(async () => {
      const txBody = {
        from: wallet.address,
        to: '0x' + uuid().replace(/-/g, '').slice(0, 40),
        amount: 1,
        gasPrice: 1,
        gasLimit: 21000,
        privateKey: wallet.privateKey
      };
      return request('POST', '/transaction', txBody);
    }));
  }

  // 执行
  startTime = Date.now();
  const results = await Promise.all(tasks);
  endTime = Date.now();

  // 收集数据
  let success = 0, failed = 0;
  for (const res of results) {
    latencies.push(res.latency);
    if (res.status === 200 && res.data.success) {
      success++;
    } else {
      failed++;
    }
  }

  const totalTimeMs = endTime - startTime;
  const totalTimeSec = totalTimeMs / 1000;
  const tps = success / totalTimeSec;

  // 3. 输出报告
  console.log('');
  console.log('📊 Benchmark Results:');
  console.log(`   Duration: ${totalTimeMs} ms (${totalTimeSec.toFixed(2)} s)`);
  console.log(`   Successful: ${success}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Throughput: ${tps.toFixed(2)} TPS`);

  // 延迟统计
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const min = latencies[0];
  const max = latencies[latencies.length - 1];

  console.log('');
  console.log('⏱️  Latency (ms):');
  console.log(`   Min: ${min}`);
  console.log(`   Avg: ${Math.round(avg)}`);
  console.log(`   Median (p50): ${p50}`);
  console.log(`   p95: ${p95}`);
  console.log(`   p99: ${p99}`);
  console.log(`   Max: ${max}`);

  // 4. 检查链状态
  const chainInfo = await request('GET', '/chain');
  console.log('');
  console.log('📈 Final Chain State:');
  console.log(`   Blocks: ${chainInfo.data.blocks.length}`);
  console.log(`   Pending: ${chainInfo.data.pendingTx}`);
  console.log(`   Difficulty: ${chainInfo.data.difficulty}`);
  console.log(`   Valid: ${chainInfo.data.valid ? '✅' : '❌'}`);

  console.log('');
  console.log('✅ Benchmark complete!');
}

benchmark().catch(err => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
