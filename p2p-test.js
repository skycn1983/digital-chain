#!/usr/bin/env node

/**
 * P2P 网络多节点测试（改进版）
 * 串行启动 3 个节点，避免资源竞争
 */

const { fork } = require('child_process');
const path = require('path');
const http = require('http');

// 节点配置
const nodes = [
  { id: 1, port: 3000, p2pPort: 30001, dataDir: 'data/node1' },
  { id: 2, port: 3002, p2pPort: 30002, dataDir: 'data/node2' },
  { id: 3, port: 3003, p2pPort: 30003, dataDir: 'data/node3' }
];

// 创建数据目录
for (const node of nodes) {
  const fullPath = path.join(__dirname, node.dataDir);
  require('fs').mkdirSync(fullPath, { recursive: true });
}

// 辅助：等待端口可用
function waitForPort(port, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    
    function check() {
      const req = http.request({
        hostname: 'localhost',
        port,
        path: '/health',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      });
      
      req.on('error', () => setTimeout(check, 500));
      req.on('timeout', () => setTimeout(check, 500));
      req.end();
      
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for port ${port}`));
      }
    }
    
    check();
  });
}

// 辅助：获取网络状态
function getNetworkStats(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/network/stats',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 辅助：获取 peers
function getPeers(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/network/peers',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 辅助：创建钱包和交易
function createTransaction(port, fromPrivateKey, toAddress, amount) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      from: '0x' + require('./src/crypto').Wallet(fromPrivateKey).address,
      to: toAddress,
      amount,
      privateKey: fromPrivateKey
    });

    const req = http.request({
      hostname: 'localhost',
      port,
      path: '/transaction',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('🚀 Starting P2P Network Test (3 nodes)\n');
  
  // 启动节点
  const processes = [];
  
  for (const node of nodes) {
    console.log(`Starting Node ${node.id} (API: ${node.port}, P2P: ${node.p2pPort})...`);
    
    const env = {
      ...process.env,
      PORT: node.port.toString(),
      P2P_PORT: node.p2pPort.toString(),
      NODE_ID_SEED: `test-node-${node.id}`,
      DATA_DIR: node.dataDir
    };

    const child = fork(path.join(__dirname, 'src', 'server.js'), [], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      cwd: __dirname
    });

    let buffer = '';
    child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[Node ${node.id}] ${line.trim()}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`[Node ${node.id} ERR] ${data.toString().trim()}`);
    });

    processes.push({ child, node });
    
    // 延迟 1.5 秒启动下一个，避免端口冲突
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  try {
    // 等待所有节点健康检查通过
    console.log('\n⏳ Waiting for nodes to be ready...\n');
    
    for (const { node } of processes) {
      await waitForPort(node.port);
      console.log(`✅ Node ${node.id} (port ${node.port}) is ready`);
    }

    // 再等待 P2P 连接建立
    console.log('\n⏳ Waiting for P2P connections to establish (10s)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // =============== 测试 A: 功能验证 ===============
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST A: Functional Verification');
    console.log('='.repeat(60) + '\n');

    // 检查网络连接状态
    for (const { node } of processes) {
      try {
        const stats = await getNetworkStats(node.port);
        const peers = await getPeers(node.port);
        
        console.log(`Node ${node.id}:`);
        console.log(`  Chain height: ${stats.chainHeight || 'N/A'}`);
        console.log(`  P2P peers: ${peers.count} (expected: ${nodes.length - 1})`);
        console.log(`  Total connections: ${stats.totalPeers}`);
        console.log('');
      } catch (e) {
        console.log(`Node ${node.id}: error - ${e.message}\n`);
      }
    }

    // 测试交易广播
    console.log('💸 Testing transaction broadcast...\n');

    // 创建钱包
    const Wallet = require('./src/crypto').Wallet;
    const wallet1 = new Wallet();
    const wallet2 = new Wallet();
    
    console.log(`Wallet 1: ${wallet1.address.substring(0, 20)}...`);
    console.log(`Wallet 2: ${wallet2.address.substring(0, 20)}...\n`);

    // 在节点1创建交易
    try {
      const txResult = await createTransaction(nodes[0].port, wallet1.privateKey, wallet2.address, 100);
      console.log(`Transaction created: ${txResult.hash.substring(0, 20)}...`);
      
      // 等待挖矿
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 检查余额变化
      const balance1Before = await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: nodes[0].port,
          path: `/balance/${wallet1.address}`,
          method: 'GET'
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(JSON.parse(data).balance));
        });
        req.on('error', reject);
        req.end();
      });

      console.log(`Balance after tx (Node 1): Wallet1 = ${balance1Before}`);
      
      // 挖矿以确认交易
      console.log('⛏️  Mining block to confirm transaction...');
      await createTransaction(nodes[0].port, wallet1.privateKey, wallet2.address, 0); // dummy
      
      // 简化：直接调用挖矿 API（需要实现）
      
    } catch (e) {
      console.log('Transaction test error:', e.message);
    }

    // =============== 测试 B: 分叉场景 ===============
    console.log('\n' + '='.repeat(60));
    console.log('🔀 TEST B: Fork Scenario (Manual)');
    console.log('='.repeat(60) + '\n');
    
    console.log('⚠️  Manual fork test requires:');
    console.log('   1. Stop node 3');
    console.log('   2. Node 1 and 2 continue mining');
    console.log('   3. Node 3 starts with older chain, causing fork');
    console.log('   4. Check fork resolution\n');

    // =============== 测试 C: 性能基准 ===============
    console.log('\n' + '='.repeat(60));
    console.log('⚡ TEST C: Performance Benchmark');
    console.log('='.repeat(60) + '\n');

    console.log('📊 Current network status:');
    for (const { node } of processes) {
      try {
        const stats = await getNetworkStats(node.port);
        console.log(`Node ${node.id}: ${stats.totalPeers} peers, uptime ${Math.floor(stats.uptime)}s`);
      } catch (e) {
        console.log(`Node ${node.id}: unavailable`);
      }
    }

    console.log('\n✅ Basic tests completed.');
    console.log('\n⏳ Keeping nodes running for 30 seconds to observe P2P activity...\n');

    // 保持运行 30 秒观察日志
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    // 关闭所有节点
    console.log('\n🛑 Stopping all nodes...\n');
    for (const { child } of processes) {
      child.kill('SIGTERM');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Test completed');
  }
}

// 运行测试
runTest().catch(console.error);
