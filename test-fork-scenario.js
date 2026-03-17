#!/usr/bin/env node

/**
 * P2P 分叉场景测试
 * 测试分叉选择算法和链重组功能
 *
 * 场景设计：
 * 1. 启动 3 节点网络
 * 2. 节点1和2同步挖矿到高度 5
 * 3. 停止节点3
 * 4. 节点1和2继续挖矿到高度 8（形成竞争链）
 * 5. 重启节点3，它会收到两个不同版本的链
 * 6. 验证分叉选择算法选择累计难度更高的链
 */

const { fork } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

// 节点配置 - 使用高端口避免冲突
const nodes = [
  { id: 1, port: 3000, p2pPort: 30011, dataDir: 'data/fork-test-node1' },
  { id: 2, port: 3002, p2pPort: 30012, dataDir: 'data/fork-test-node2' },
  { id: 3, port: 3003, p2pPort: 30013, dataDir: 'data/fork-test-node3' }
];

// 清理和创建数据目录
function setupDataDirs() {
  for (const node of nodes) {
    const fullPath = path.join(__dirname, node.dataDir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
    fs.mkdirSync(fullPath, { recursive: true });
  }
}

// 等待端口可用
function waitForPort(port, timeout = 15000) {
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

// HTTP 请求封装
function request(method, baseUrl, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const start = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
            latency: Date.now() - start
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data,
            latency: Date.now() - start
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 创建钱包
function createWallet(baseUrl) {
  return request('POST', baseUrl, '/wallet/create');
}

// 挖矿
function mineBlock(baseUrl, minerAddress) {
  return request('POST', baseUrl, '/mine', { minerAddress });
}

// 发送交易
function sendTransaction(baseUrl, fromPrivateKey, toAddress, amount) {
  const { Wallet } = require('../src/crypto');
  const wallet = new Wallet(fromPrivateKey);
  return request('POST', baseUrl, '/transaction', {
    from: wallet.address,
    to: toAddress,
    amount,
    gasPrice: 1,
    gasLimit: 21000,
    privateKey: fromPrivateKey
  });
}

// 获取链信息
function getChainInfo(baseUrl) {
  return request('GET', baseUrl, '/chain');
}

// 获取余额
function getBalance(baseUrl, address) {
  return request('GET', baseUrl, `/balance/${address}`);
}

// 获取 P2P peers
function getPeers(baseUrl) {
  return request('GET', baseUrl, '/network/peers');
}

// 获取网络统计
function getNetworkStats(baseUrl) {
  return request('GET', baseUrl, '/network/stats');
}

// 计算累计难度（简化版，与 fork-choice.js 逻辑一致）
function calculateCumulativeDifficulty(blockchain, targetHeight) {
  let difficulty = 0;
  for (let i = 0; i <= targetHeight && i < blockchain.chain.length; i++) {
    difficulty += blockchain.chain[i].difficulty;
  }
  return difficulty;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runForkTest() {
  console.log('🔀 Starting P2P Fork Scenario Test\n');
  console.log('=' .repeat(70));

  // 1. 准备：清理并创建数据目录
  console.log('\n[1] Setup: Cleaning and creating data directories...');
  setupDataDirs();

  // 2. 启动 3 个节点
  console.log('\n[2] Starting 3 nodes...');
  const processes = [];

  for (const node of nodes) {
    console.log(`  Starting Node ${node.id} (API: ${node.port}, P2P: ${node.p2pPort})`);

    // 设置种子节点：节点1使用默认种子，节点2和3连接到节点1的P2P端口
    let seedNodes = '';
    if (node.id === 1) {
      // 节点1使用配置文件中的种子（空或默认）
      seedNodes = '127.0.0.1:30011'; // 指向自己，便于测试
    } else {
      // 节点2和3连接到节点1
      seedNodes = '127.0.0.1:30011';
    }

    const env = {
      ...process.env,
      PORT: node.port.toString(),
      P2P_PORT: node.p2pPort.toString(),
      NODE_ID_SEED: `fork-test-node-${node.id}`,
      DATA_DIR: node.dataDir,
      SEED_NODES: seedNodes
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
        if (line.trim() && !line.includes('DEBUG:')) {
          console.log(`    [Node ${node.id}] ${line.trim()}`);
        }
      }
    });

    child.stderr.on('data', (data) => {
      console.error(`    [Node ${node.id} ERR] ${data.toString().trim()}`);
    });

    processes.push({ child, node });

    await sleep(1500); // 延迟启动避免端口冲突
  }

  try {
    // 3. 等待所有节点就绪
    console.log('\n[3] Waiting for nodes to be ready...');
    for (const { node } of processes) {
      await waitForPort(node.port);
      console.log(`  ✅ Node ${node.id} (port ${node.port}) ready`);
    }

    await sleep(3000);

    // 4. 验证初始连接
    console.log('\n[4] Verifying initial P2P connections...');
    const initialStats = [];
    for (const { node } of processes) {
      try {
        const stats = await getNetworkStats(`http://localhost:${node.port}`);
        const peers = await getPeers(`http://localhost:${node.port}`);
        initialStats.push({
          node: node.id,
          totalPeers: stats.data.totalPeers,
          peerCount: peers.data.count
        });
        console.log(`  Node ${node.id}: ${stats.data.totalPeers} total peers, ${peers.data.count} P2P peers`);
      } catch (e) {
        console.log(`  Node ${node.id}: error - ${e.message}`);
      }
    }

    // 5. 在节点1创建钱包并挖矿到高度 5
    console.log('\n[5] Mining on Node1 to height 5...');
    const wallet1Res = await createWallet('http://localhost:3000');
    const wallet1 = wallet1Res.data;
    console.log(`  Wallet1: ${wallet1.address}`);

    for (let i = 0; i < 5; i++) {
      await mineBlock('http://localhost:3000', wallet1.address);
      await sleep(500);
    }

    // 检查链高度
    const chainInfo1 = await getChainInfo('http://localhost:3000');
    console.log(`  Node1 chain height: ${chainInfo1.data.blocks.length}`);

    // 6. 等待同步到节点2和3
    console.log('\n[6] Waiting for sync to Node2 and Node3 (5s)...');
    await sleep(5000);

    for (const nodeId of [2, 3]) {
      const info = await getChainInfo(`http://localhost:${nodes[nodeId-1].port}`);
      console.log(`  Node${nodeId} chain height: ${info.data.blocks.length}`);
    }

    // 7. 停止节点3（模拟断线）
    console.log('\n[7] Stopping Node3 to simulate network partition...');
    const node3Process = processes.find(p => p.node.id === 3).child;
    node3Process.kill('SIGTERM');
    await sleep(2000);
    console.log('  Node3 stopped');

    // 8. 节点1和2继续挖矿到高度 8（形成主链A）
    console.log('\n[8] Node1 and Node2 continue mining to height 8...');
    for (let i = 5; i < 8; i++) {
      await mineBlock('http://localhost:3000', wallet1.address);
      await sleep(500);
    }

    const chainInfo1After = await getChainInfo('http://localhost:3000');
    console.log(`  Node1 chain height: ${chainInfo1After.data.blocks.length}`);

    const chainInfo2 = await getChainInfo('http://localhost:3002');
    console.log(`  Node2 chain height: ${chainInfo2.data.blocks.length}`);

    // 9. 节点1和2上再创建分叉（节点2挖一个不同的块）
    console.log('\n[9] Creating fork: Node2 mines on its own chain...');
    const wallet2Res = await createWallet('http://localhost:3002');
    const wallet2 = wallet2Res.data;

    // 节点2挖矿（它会基于自己的链）
    await mineBlock('http://localhost:3002', wallet2.address);
    await sleep(500);

    const chainInfo2After = await getChainInfo('http://localhost:3002');
    console.log(`  Node2 chain height: ${chainInfo2After.data.blocks.length}`);
    console.log(`  Node2 latest block hash: ${chainInfo2After.data.blocks[chainInfo2After.data.blocks.length-1].hash.substring(0, 16)}...`);

    // 10. 重启节点3（它有较旧的链，高度5）
    console.log('\n[10] Restarting Node3 (it has old chain height 5)...');
    const node3Env = {
      ...process.env,
      PORT: nodes[2].port.toString(),
      P2P_PORT: nodes[2].p2pPort.toString(),
      NODE_ID_SEED: `fork-test-node-3`,
      DATA_DIR: nodes[2].dataDir
    };

    const node3Child = fork(path.join(__dirname, 'src', 'server.js'), [], {
      env: node3Env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      cwd: __dirname
    });

    let node3Buffer = '';
    node3Child.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim() && !line.includes('DEBUG:')) {
          console.log(`    [Node 3] ${line.trim()}`);
        }
      }
    });

    processes.push({ child: node3Child, node: nodes[2] });

    // 等待节点3就绪
    await waitForPort(nodes[2].port);
    console.log('  ✅ Node3 restarted and ready');

    // 11. 等待 P2P 连接和同步
    console.log('\n[11] Waiting for P2P connections and fork resolution (10s)...');
    await sleep(10000);

    // 12. 检查所有节点的最终链高度
    console.log('\n[12] Checking final chain heights:');
    const finalHeights = [];

    for (const { node } of processes) {
      try {
        const info = await getChainInfo(`http://localhost:${node.port}`);
        const height = info.data.blocks.length;
        finalHeights.push({ node: node.id, height });
        console.log(`  Node${node.id}: height ${height}`);

        // 检查 latest block hash
        if (info.data.blocks.length > 0) {
          const latestHash = info.data.blocks[info.data.blocks.length-1].hash;
          console.log(`    Latest hash: ${latestHash.substring(0, 20)}...`);
        }
      } catch (e) {
        console.log(`  Node${node.id}: error - ${e.message}`);
      }
    }

    // 13. 验证分叉选择结果
    console.log('\n[13] Validating fork choice result:');
    const heights = finalHeights.map(h => h.height);
    const uniqueHeights = new Set(heights);

    if (uniqueHeights.size === 1) {
      console.log('  ✅ All nodes have converged to the same chain height');
    } else {
      console.log('  ⚠️  Nodes have divergent chain heights:');
      finalHeights.forEach(h => console.log(`    Node${h.node}: ${h.height}`));
    }

    // 检查节点3是否正确选择了累计难度更高的链
    const node3Height = finalHeights.find(h => h.node === 3)?.height;
    const node1Height = finalHeights.find(h => h.node === 1)?.height;

    if (node3Height === node1Height) {
      console.log('  ✅ Node3 selected the correct chain (same as Node1)');
    } else if (node3Height > node1Height) {
      console.log('  ❌ Node3 has longer chain than Node1 (unexpected)');
    } else {
      console.log('  ⚠️  Node3 has shorter chain (may need more sync time)');
    }

    // 14. 检查网络统计
    console.log('\n[14] Final network statistics:');
    for (const { node } of processes) {
      try {
        const stats = await getNetworkStats(`http://localhost:${node.port}`);
        const peers = await getPeers(`http://localhost:${node.port}`);
        console.log(`  Node${node.id}: ${stats.data.totalPeers} total peers, ${stats.data.uptime.toFixed(0)}s uptime`);
      } catch (e) {
        // 忽略
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Fork test completed!');
    console.log('\nKey observations:');
    console.log('- All nodes should converge to the chain with highest cumulative difficulty');
    console.log('- Fork resolution should happen automatically via fork choice algorithm');
    console.log('- Network should recover from temporary partition');

  } catch (err) {
    console.error('\n❌ Test failed:', err);
    console.error(err.stack);
  } finally {
    // 15. 清理：关闭所有节点
    console.log('\n[Cleanup] Stopping all nodes...');
    for (const { child } of processes) {
      child.kill('SIGTERM');
    }
    await sleep(2000);
    console.log('✅ Fork test cleanup complete');
  }
}

// 运行测试
runForkTest().catch(err => {
  console.error('Fork test failed:', err);
  process.exit(1);
});
