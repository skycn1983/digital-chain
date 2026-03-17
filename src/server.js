const express = require('express');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { Blockchain } = require('./blockchain');
const { Wallet } = require('./crypto');
const { Transaction } = require('./transaction');
const { P2PServer } = require('./p2p/server');

// 支持自定义数据目录
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const app = express();
const blockchain = new Blockchain(2, 50, dataDir);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Create wallet
app.post('/wallet/create', (req, res) => {
  try {
    const wallet = new Wallet();
    const isProduction = process.env.NODE_ENV === 'production';
    res.json({
      success: true,
      address: wallet.address,
      publicKey: wallet.publicKey,
      // 生产环境不返回私钥
      ...(isProduction ? {} : { privateKey: wallet.privateKey }),
      message: isProduction
        ? 'Wallet created. Private key is not returned in production mode.'
        : 'Wallet created. Save private key securely!'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get balance
app.get('/balance/:address', (req, res) => {
  try {
    const balance = blockchain.getBalance(req.params.address);
    res.json({ address: req.params.address, balance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get transaction count (nonce)
app.get('/nonce/:address', (req, res) => {
  try {
    const nonce = blockchain.getNonce(req.params.address);
    res.json({ address: req.params.address, nonce });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create transaction
app.post('/transaction', (req, res) => {
  try {
    const { from, to, amount, gasPrice = 1, gasLimit = 21000, privateKey, nonce: explicitNonce } = req.body;

    if (!from || !to || !amount) {
      return res.status(400).json({ error: 'Missing required fields: from, to, amount' });
    }

    // 确定 nonce：如果显式提供则使用，否则自动获取
    let nonce;
    if (explicitNonce !== undefined) {
      nonce = explicitNonce;
      // 验证 nonce 是否重复
      const existing = blockchain.pendingTransactions.find(t => t.from === from && t.nonce === nonce);
      if (existing) {
        return res.status(400).json({ error: `Duplicate nonce ${nonce} for sender ${from}` });
      }
    } else {
      nonce = blockchain.getNonce(from);
    }

    // If privateKey is provided, derive publicKey and sign properly
    let tx;
    if (privateKey) {
      const wallet = new Wallet(privateKey);
      if (wallet.address !== from) {
        return res.status(400).json({ error: 'Private key does not match from address' });
      }
      tx = new Transaction(from, to, amount, nonce, gasPrice, gasLimit);
      tx.sign(wallet);
      // 附加公钥用于验证
      tx.publicKey = wallet.publicKey;
    } else {
      // Demo mode: skip private key verification
      tx = new Transaction(from, to, amount, nonce, gasPrice, gasLimit);
      tx.signature = 'demo_sig_' + Date.now(); // demo signature
      // 注意: demo 模式不包含 publicKey，P2P 网络将拒绝此交易
    }

    // Add to pending pool
    blockchain.addTransaction(tx);

    // Broadcast to P2P network
    if (typeof broadcastP2P === 'function') {
      broadcastP2P('tx_broadcast', { transaction: tx.serialize() });
    }

    res.json({
      success: true,
      hash: tx.getHash(),
      from: from,
      to: to,
      amount: amount,
      nonce: tx.nonce
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mine block (requires miner address)
app.post('/mine', (req, res) => {
  try {
    const { minerAddress } = req.body;

    if (!minerAddress) {
      return res.status(400).json({ error: 'minerAddress required' });
    }

    // Mine block
    const block = blockchain.mineBlock(minerAddress);

    // Adjust difficulty
    blockchain.adjustDifficulty();

    res.json({
      success: true,
      block: {
        index: block.index,
        hash: block.hash,
        transactions: block.transactions.length,
        timestamp: block.timestamp
      },
      stats: blockchain.getStats()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get chain info
app.get('/chain', (req, res) => {
  try {
    const stats = blockchain.getStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get specific block
app.get('/block/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (isNaN(index) || index < 0 || index >= blockchain.chain.length) {
      return res.status(404).json({ error: 'Block not found' });
    }
    const block = blockchain.chain[index];
    res.json(block.serialize());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get pending transactions
app.get('/pending', (req, res) => {
  try {
    res.json({
      count: blockchain.pendingTransactions.length,
      transactions: blockchain.pendingTransactions.map(tx => ({
        hash: tx.getHash(),
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        nonce: tx.nonce
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    chainLength: blockchain.chain.length,
    pendingTx: blockchain.pendingTransactions.length
  });
});

// ==================== P2P Network API (调试用) ====================

// Get network peers list
app.get('/network/peers', (req, res) => {
  try {
    if (!global.p2p) {
      return res.status(503).json({ error: 'P2P not initialized' });
    }
    const peers = global.p2p.getPeersList();
    res.json({
      peers,
      count: peers.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get network stats
app.get('/network/stats', (req, res) => {
  try {
    if (!global.p2p) {
      return res.status(503).json({ error: 'P2P not initialized' });
    }
    const stats = global.p2p.getStats();
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Force disconnect a peer (admin)
app.post('/network/disconnect', (req, res) => {
  try {
    if (!global.p2p) {
      return res.status(503).json({ error: 'P2P not initialized' });
    }
    const { nodeId } = req.body;
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId required' });
    }

    const peer = global.p2p.peers.get(nodeId);
    if (!peer) {
      return res.status(404).json({ error: 'Peer not found' });
    }

    peer.disconnect();
    res.json({ success: true, message: `Peer ${nodeId} disconnected` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`\n🚀 Digital Chain Node Started`);
  console.log(`📍 API Server: http://localhost:${PORT}`);
  console.log(`📊 Chain file: ${blockchain.chainFile}`);
  console.log(`🔗 Current height: ${blockchain.chain.length} blocks`);
  console.log(`⛏️  Block reward: ${blockchain.blockReward} OCT`);
  console.log(`🎯 Difficulty: ${blockchain.difficulty}`);
  console.log('\n📋 API Endpoints:');
  console.log('  POST /wallet/create              - Create new wallet');
  console.log('  GET  /balance/:address          - Get balance');
  console.log('  GET  /nonce/:address            - Get transaction count');
  console.log('  POST /transaction               - Create & sign transaction');
  console.log('  POST /mine                      - Mine next block');
  console.log('  GET  /chain                     - Full chain info');
  console.log('  GET  /block/:index              - Get specific block');
  console.log('  GET  /pending                   - Pending transactions');
  console.log('  GET  /health                    - Health check');

  // 启动 P2P 网络
  try {
    console.log('P2P environment: PORT=' + process.env.PORT + ', P2P_PORT=' + process.env.P2P_PORT);
    // 加载种子节点配置
    const seedNodes = [];
    
    // 支持环境变量 SEED_NODES (逗号分隔的地址列表，如 "127.0.0.1:30001,127.0.0.1:30003")
    if (process.env.SEED_NODES) {
      const envSeeds = process.env.SEED_NODES.split(',').map(s => s.trim()).filter(Boolean);
      seedNodes.push(...envSeeds);
      console.log('Loaded seed nodes from SEED_NODES env:', envSeeds);
    } else {
      // 从配置文件加载
      const seedNodesPath = path.join(__dirname, '..', 'config', 'seed-nodes.json');
      if (fs.existsSync(seedNodesPath)) {
        const seedConfig = JSON.parse(fs.readFileSync(seedNodesPath, 'utf8'));
        for (const seed of seedConfig) {
          seedNodes.push(seed.address);
        }
        console.log('Loaded seed nodes from config file:', seedNodes);
      }
    }

    const p2pConfig = {
      port: parseInt(process.env.P2P_PORT) || 30001,
      seedNodes,
      maxInbound: 50,
      maxOutbound: 20
    };
    console.log('P2P config:', p2pConfig);

    const p2p = new P2PServer(blockchain, p2pConfig);

    // 注册 P2P 消息处理器（使用 messageHandlers.set 避免实例属性遮蔽）
    const p2pHandlers = require('./p2p/messages');
    p2p.messageHandlers.set('ping', p2pHandlers.handlePing);
    p2p.messageHandlers.set('pong', p2pHandlers.handlePong);
    p2p.messageHandlers.set('get_peers', p2pHandlers.handleGetPeers);
    p2p.messageHandlers.set('peers', (peer, payload) => p2pHandlers.handlePeers(p2p, peer, payload));
    p2p.messageHandlers.set('get_blocks', (peer, payload) => p2pHandlers.handleGetBlocks(p2p, peer, payload, blockchain));
    p2p.messageHandlers.set('blocks', (peer, payload) => p2pHandlers.handleBlocks(p2p, peer, payload, blockchain));
    p2p.messageHandlers.set('tx_broadcast', (peer, payload) => p2pHandlers.handleTxBroadcast(p2p, peer, payload, blockchain));
    p2p.messageHandlers.set('new_transaction', (peer, payload) => p2pHandlers.handleNewTransaction(p2p, peer, payload, blockchain));
    p2p.messageHandlers.set('new_block', (peer, payload) => p2pHandlers.handleNewBlock(p2p, peer, payload, blockchain));
    p2p.messageHandlers.set('error', p2pHandlers.handleError);

    await p2p.start();
    console.log(`🔗 P2P server running on port 30001`);
    console.log(`🌐 Total peers: ${p2p.getStats().totalPeers}`);

    // 替换 P2P 广播函数
    broadcastP2P = (event, data) => {
      p2p.broadcast(event, data);
    };

    // 暴露 p2p 实例到全局（用于调试）
    global.p2p = p2p;

  } catch (err) {
    console.error('Failed to start P2P server:', err.message);
    console.log('⚠️  Continuing without P2P network');
  }

  console.log('\n✅ All systems ready\n');
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket client connected');
  
  // Send initial chain state (use getStats() directly for consistency)
  ws.send(JSON.stringify({
    type: 'chain_update',
    data: blockchain.getStats()
  }));

  ws.on('close', () => {
    console.log('🔗 WebSocket client disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

// Broadcast to all connected clients (WebSocket)
function broadcastWS(event, data) {
  const message = JSON.stringify({ type: event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

// Placeholder for P2P broadcast (will be initialized later)
let broadcastP2P = (event, data) => {
  console.warn('P2P broadcast called before P2P initialized');
};

// Combined broadcast function
function broadcast(event, data) {
  broadcastWS(event, data);
  broadcastP2P(event, data);
}

// Hook into blockchain events
const originalAddTransaction = blockchain.addTransaction.bind(blockchain);
blockchain.addTransaction = function(tx) {
  const result = originalAddTransaction(tx);
  broadcast('new_transaction', {
    hash: tx.getHash(),
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    nonce: tx.nonce,
    timestamp: tx.timestamp
  });
  return result;
};

const originalMineBlock = blockchain.mineBlock.bind(blockchain);
blockchain.mineBlock = function(minerAddress) {
  const block = originalMineBlock(minerAddress);
  // 广播完整区块数据（使用 serialize）
  broadcast('new_block', { block: block.serialize() });
  broadcastWS('chain_update', blockchain.getStats());
  return block;
};

console.log('🔗 WebSocket server running on ws://localhost:' + PORT);

module.exports = { app, blockchain };