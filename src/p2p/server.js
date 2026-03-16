/**
 * P2P 服务器 - 管理节点网络
 */

const net = require('net');
const { MessageReader, send } = require('./message');
const { Peer } = require('./peer');
const { Handshake } = require('./handshake');
const { ForkChoice } = require('./sync/fork-choice');
const { TransactionPool } = require('./broadcast/transaction-pool');
const logger = require('../utils/logger')('P2P');
console.log('Logger loaded from:', __dirname);
console.log('Logger:', typeof logger);

class P2PServer {
  constructor(blockchain, config = {}) {
    this.blockchain = blockchain;

    // 配置
    this.port = config.port || 30001;
    this.maxInbound = config.maxInbound || 50;
    this.maxOutbound = config.maxOutbound || 20;
    this.maxTotal = config.maxTotal || 100;
    this.pingInterval = config.pingInterval || 30000;
    this.pingTimeout = config.pingTimeout || 10000;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts || 10;

    // 连接池
    this.peers = new Map();           // nodeId -> Peer
    this.peersByAddress = new Map();  // address -> Peer
    this.inboundCount = 0;
    this.outboundCount = 0;

    // 种子节点
    this.seedNodes = config.seedNodes || [];

    // 重连队列
    this.reconnectQueue = []; // [{address, attempts, lastAttempt}]

    // 服务器实例
    this.server = null;

    // 心跳定时器
    this.pingTimer = null;

    // 消息处理器（外部注册）
    this.messageHandlers = new Map();

    // 事件监听器
    this.onPeerConnected = null;
    this.onPeerDisconnected = null;
    this.onMessage = null; // (peer, type, payload) => void

    // 高级功能（可选初始化）
    this.forkChoice = null;      // 分叉选择器
    this.transactionPool = null; // 交易池管理器
    this.mdns = null;            // mDNS 发现
  }

  /**
   * 启动 P2P 服务器
   */
  start() {
    return new Promise((resolve, reject) => {
      // 创建 TCP 服务器
      this.server = net.createServer((socket) => {
        this._handleInboundConnection(socket);
      });

      this.server.on('error', (err) => {
        logger.error('Server error:', err.message);
        reject(err);
      });

      this.server.on('listening', () => {
        logger.info(`P2P server listening on port ${this.port}`);
        resolve();
      });

      this.server.listen(this.port, '0.0.0.0');

      // 初始化高级模块
      this.forkChoice = new ForkChoice(this.blockchain);
      this.transactionPool = new TransactionPool(this.blockchain);

      // 启动 mDNS 发现（如果可用）
      try {
        const { MDNSDiscovery } = require('./discovery/mdns');
        this.mdns = new MDNSDiscovery(this);
        this.mdns.start().catch((err) => {
          console.warn('mDNS discovery failed:', err.message);
        });
      } catch (e) {
        console.warn('mDNS not available (dgram module missing?)');
      }

      // 启动心跳定时器
      this._startPingTimer();

      // 启动出站连接（种子节点）
      this._connectToSeeds();

      // 注册区块链事件钩子
      this._hookBlockchainEvents();
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    // 断开所有连接
    for (const [id, peer] of this.peers) {
      peer.disconnect();
    }
    this.peers.clear();
    this.peersByAddress.clear();
  }

  /**
   * 处理入站连接
   * @param {net.Socket} socket
   */
  _handleInboundConnection(socket) {
    const remoteAddress = socket.remoteAddress + ':' + socket.remotePort;

    logger.debug(`Inbound connection from ${remoteAddress}`);

    // 检查是否超过入站限制
    if (this.inboundCount >= this.maxInbound) {
      logger.warn(`Rejecting inbound from ${remoteAddress}: max inbound reached`);
      socket.destroy();
      return;
    }

    // 检查是否重复连接
    if (this.peersByAddress.has(remoteAddress)) {
      logger.warn(`Rejecting duplicate connection from ${remoteAddress}`);
      socket.destroy();
      return;
    }

    const reader = new MessageReader(socket);
    let peer = null;
    let handshakeTimer = null;

    // 处理 handshake
    reader.on('handshake', (msg) => {
      clearTimeout(handshakeTimer);

      const handshake = new Handshake(msg.payload);

      // 验证协议版本
      if (handshake.protocolVersion !== '0.1') {
        logger.warn(`Protocol mismatch with ${remoteAddress}: ${handshake.protocolVersion}`);
        send(socket, {
          type: 'error',
          payload: { code: 1001, message: 'Unsupported protocol version' }
        });
        socket.destroy();
        return;
      }

      // 检查是否已存在同节点（不同地址）
      if (this.peers.has(handshake.nodeId)) {
        const existing = this.peers.get(handshake.nodeId);
        if (existing.address !== remoteAddress) {
          logger.info(`Node ${handshake.nodeId} reconnected from new address ${remoteAddress}`);
          existing.disconnect(); // 断开旧连接
        }
      }

      // 创建 Peer 对象
      peer = new Peer(socket, remoteAddress, {
        ...handshake.data,
        _outbound: false
      });

      // 注册连接关闭处理
      peer.onClose = () => this._handlePeerClose(peer);
      peer.onError = (err) => logger.error(`Peer ${peer.id} error:`, err.message);

      // 添加到池子
      this._addPeer(peer);

      // 注册消息处理器到 reader（handshake 成功后）
      for (const [type, handler] of this.messageHandlers) {
        reader.on(type, (msg) => handler(peer, msg.payload));
      }

      // 响应 handshake
      send(socket, {
        type: 'handshake',
        payload: {
          protocolVersion: '0.1',
          nodeId: this._getLocalNodeId(),
          address: this._getLocalAddress(),
          chainHeight: this.blockchain.chain.length,
          difficulty: this.blockchain.difficulty,
          blockReward: this.blockchain.blockReward,
          userAgent: 'digital-chain/1.0'
        }
      });

      logger.info(`Handshake completed with ${peer.id} (${remoteAddress}), height=${peer.chainHeight}`);

      // 如果对方链更高，请求同步
      if (peer.chainHeight > this.blockchain.chain.length) {
        this._requestSync(peer);
      }

      // 发送 peers 列表
      this._sendPeerList(peer);

      // 触发事件
      if (this.onPeerConnected) {
        this.onPeerConnected(peer);
      }
    });

    // 设置 handshake 超时
    handshakeTimer = setTimeout(() => {
      if (!peer) {
        logger.warn(`Handshake timeout from ${remoteAddress}`);
        socket.destroy();
      }
    }, 10000);

    reader.start();

    // 注册消息处理器（在 reader 初始化之后）
    const handlers = require('./messages');
    const blockchain = this.blockchain;

    reader.on('message', (msg) => {
      peer.messagesReceived++;

      // 通用处理器
      if (this.onMessage) {
        this.onMessage(peer, msg.type, msg.payload);
      }

      // 类型特定处理器
      switch (msg.type) {
        case 'ping':
          handlers.handlePing(peer, msg.payload);
          break;
        case 'pong':
          handlers.handlePong(peer, msg.payload);
          break;
        case 'get_peers':
          handlers.handleGetPeers(this, peer, msg.payload);
          break;
        case 'peers':
          handlers.handlePeers(this, peer, msg.payload);
          break;
        case 'get_blocks':
          handlers.handleGetBlocks(this, peer, msg.payload, blockchain);
          break;
        case 'blocks':
          handlers.handleBlocks(this, peer, msg.payload, blockchain);
          break;
        case 'tx_broadcast':
          handlers.handleTxBroadcast(this, peer, msg.payload, blockchain);
          break;
        case 'new_block':
          handlers.handleNewBlock(this, peer, msg.payload, blockchain);
          break;
        case 'error':
          handlers.handleError(peer, msg.payload);
          break;
        default:
          logger.warn(`Unknown message type: ${msg.type} from ${peer.id}`);
      }
    });

    // 存储 reader 到 socket 对象，便于后续访问
    socket._reader = reader;
  }

  /**
   * 出站连接到指定地址
   * @param {string} address - "ip:port"
   * @returns {Promise<Peer>}
   */
  connect(address) {
    return new Promise((resolve, reject) => {
      // 检查是否已连接
      if (this.peersByAddress.has(address)) {
        return resolve(this.peersByAddress.get(address));
      }

      // 检查出站限制
      if (this.outboundCount >= this.maxOutbound) {
        return reject(new Error('Max outbound connections reached'));
      }

      logger.debug(`Connecting to ${address}`);

      const socket = net.createConnection({
        host: address.split(':')[0],
        port: parseInt(address.split(':')[1])
      }, () => {
        logger.debug(`TCP connection established to ${address}`);
      });

      socket.on('error', (err) => {
        logger.error(`Connection error to ${address}:`, err.message);
        reject(err);
      });

      socket.on('close', () => {
        // 连接关闭，可能在 handshake 前
        if (!peer) {
          reject(new Error('Connection closed before handshake'));
        }
      });

      const reader = new MessageReader(socket);
      let peer = null;
      let handshakeTimer = null;

      // 发送 handshake
      const handshakePayload = {
        protocolVersion: '0.1',
        nodeId: this._getLocalNodeId(),
        address: this._getLocalAddress(),
        chainHeight: this.blockchain.chain.length,
        difficulty: this.blockchain.difficulty,
        blockReward: this.blockchain.blockReward,
        userAgent: 'digital-chain/1.0'
      };

      socket.on('connect', () => {
        send(socket, { type: 'handshake', payload: handshakePayload });
        handshakeTimer = setTimeout(() => {
          if (!peer) {
            reject(new Error('Handshake timeout'));
            socket.destroy();
          }
        }, 10000);
      });

      // 处理响应
      reader.on('handshake', (msg) => {
        clearTimeout(handshakeTimer);

        const handshake = new Handshake(msg.payload);

        peer = new Peer(socket, address, {
          ...handshake.data,
          _outbound: true
        });

        peer.onClose = () => this._handlePeerClose(peer);
        peer.onError = (err) => logger.error(`Peer ${peer.id} error:`, err.message);

        this._addPeer(peer);

        // 注册消息处理器到 reader（handshake 成功后）
        for (const [type, handler] of this.messageHandlers) {
          reader.on(type, (msg) => handler(peer, msg.payload));
        }

        logger.info(`Connected to ${peer.id} (${address}), height=${peer.chainHeight}`);

        if (this.onPeerConnected) {
          this.onPeerConnected(peer);
        }

        // 同步检查
        if (peer.chainHeight > this.blockchain.chain.length) {
          this._requestSync(peer);
        }

        this._sendPeerList(peer);
        resolve(peer);
      });

      reader.on('error', (err) => {
        logger.error(`Connection error from ${address}:`, err.message);
        socket.destroy();
      });

      reader.start();
    });
  }

  /**
   * 广播消息给所有 peers
   * @param {string} type - 消息类型
   * @param {Object} payload - 消息体
   */
  broadcast(type, payload, excludePeer = null) {
    for (const [id, peer] of this.peers) {
      if (peer !== excludePeer && peer.socket && !peer.socket.destroyed) {
        try {
          peer.send(type, payload);
        } catch (e) {
          logger.error(`Broadcast to ${peer.id} failed:`, e.message);
        }
      }
    }
  }

  /**
   * 广播交易（Gossip 协议）
   * @param {Transaction} tx
   */
  broadcastTransaction(tx) {
    const txHash = tx.getHash();

    // 检查是否应该广播（防重复）
    if (this.transactionPool && !this.transactionPool.shouldBroadcast(txHash)) {
      return; // 最近已广播过，跳过
    }

    // 验证交易签名（P2P 网络要求）
    if (!tx.publicKey) {
      logger.warn(`Transaction ${txHash.substring(0, 12)} missing publicKey, not broadcasting via P2P`);
      return;
    }

    const payload = {
      transaction: tx.serialize()
    };

    this.broadcast('tx_broadcast', payload);

    // 标记已广播
    if (this.transactionPool) {
      this.transactionPool.markBroadcasted(txHash);
    }
  }

  /**
   * 广播新区块
   * @param {Block} block
   * @param {string} miner
   */
  broadcastBlock(block, miner) {
    const payload = {
      block: block.serialize(),
      reward: this.blockchain.blockReward,
      miner
    };
    this.broadcast('new_block', payload);
  }

  /**
   * 注册消息处理器
   * @param {string} type - 消息类型
   * @param {Function} handler - (peer, payload) => void
   */
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * 添加 peer 到池子
   * @param {Peer} peer
   */
  _addPeer(peer) {
    this.peers.set(peer.id, peer);
    this.peersByAddress.set(peer.address, peer);

    if (peer.isOutbound) {
      this.outboundCount++;
    } else {
      this.inboundCount++;
    }

    // 注意：消息处理器已在 handshake 成功后注册到 reader，此处不再重复
  }

  /**
   * 处理 peer 断开
   * @param {Peer} peer
   */
  _handlePeerClose(peer) {
    logger.info(`Peer ${peer.id} (${peer.address}) disconnected`);

    this.peers.delete(peer.id);
    this.peersByAddress.delete(peer.address);

    if (peer.isOutbound) {
      this.outboundCount--;
      this._scheduleReconnect(peer.address);
    } else {
      this.inboundCount--;
    }

    if (this.onPeerDisconnected) {
      this.onPeerDisconnected(peer);
    }
  }

  /**
   * 请求链同步
   * @param {Peer} peer
   */
  _requestSync(peer) {
    const localHeight = this.blockchain.chain.length;
    const fromHeight = localHeight + 1;
    const limit = 100;

    peer.send('get_blocks', {
      fromHeight,
      limit
    });

    logger.debug(`Requesting sync from ${peer.id}: from=${fromHeight}, limit=${limit}`);
  }

  /**
   * 发送 peers 列表
   * @param {Peer} peer
   */
  _sendPeerList(peer) {
    const peerList = [];

    for (const [id, p] of this.peers) {
      if (p !== peer && p.connectedAt > Date.now() - 5 * 60 * 1000) { // 最近 5 分钟
        peerList.push({
          nodeId: p.id,
          address: p.address,
          chainHeight: p.chainHeight,
          lastSeen: Date.now() - p.getUptime()
        });
      }
    }

    // 随机选择最多 10 个
    const shuffled = peerList.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 10);

    peer.send('peers', { peers: selected });
  }

  /**
   * 连接到种子节点
   */
  _connectToSeeds() {
    logger.info(`Connecting to ${this.seedNodes.length} seed nodes`);

    for (const address of this.seedNodes) {
      // 避免重复连接
      if (!this.peersByAddress.has(address)) {
        this._connectToSeed(address);
      }
    }
  }

  /**
   * 连接单个种子节点
   * @param {string} address
   */
  _connectToSeed(address) {
    this.connect(address)
      .then((peer) => {
        logger.info(`Connected to seed node ${address}`);
      })
      .catch((err) => {
        logger.warn(`Failed to connect to seed ${address}:`, err.message);
      });
  }

  /**
   * 调度重连
   * @param {string} address
   */
  _scheduleReconnect(address) {
    // 检查是否已经在队列中
    const existing = this.reconnectQueue.find((q) => q.address === address);
    if (existing) {
      return;
    }

    this.reconnectQueue.push({
      address,
      attempts: 0,
      lastAttempt: 0
    });

    this._processReconnectQueue();
  }

  /**
   * 处理重连队列
   */
  _processReconnectQueue() {
    if (this.reconnectQueue.length === 0) return;

    const now = Date.now();

    for (let i = this.reconnectQueue.length - 1; i >= 0; i--) {
      const item = this.reconnectQueue[i];

      if (item.attempts >= this.maxReconnectAttempts) {
        logger.warn(`Giving up reconnecting to ${item.address} after ${item.attempts} attempts`);
        this.reconnectQueue.splice(i, 1);
        continue;
      }

      if (now - item.lastAttempt < this.reconnectInterval * Math.min(item.attempts, 10)) {
        continue; // 还没到重试时间
      }

      // 尝试重连
      item.lastAttempt = now;
      item.attempts++;

      logger.debug(`Reconnecting to ${item.address} (attempt ${item.attempts})`);

      this.connect(item.address)
        .then((peer) => {
          logger.info(`Reconnected to ${item.address}`);
          this.reconnectQueue = this.reconnectQueue.filter((q) => q.address !== address);
        })
        .catch((err) => {
          logger.debug(`Reconnect to ${item.address} failed:`, err.message);
          // 继续留在队列中，下次再试
        });

      break; // 每次只试一个
    }
  }

  /**
   * 启动心跳定时器
   */
  _startPingTimer() {
    this.pingTimer = setInterval(() => {
      const now = Date.now();

      for (const [id, peer] of this.peers) {
        // 每 30 秒 ping 一次
        if (now - peer.lastPing > this.pingInterval) {
          const nonce = Math.floor(Math.random() * 1e9);
          peer.ping(nonce);

          // 设置超时检查
          setTimeout(() => {
            if (peer.pingRtt === null && !peer.socket.destroyed) {
              logger.warn(`Ping timeout for ${peer.id}, disconnecting`);
              peer.disconnect();
            }
          }, this.pingTimeout);
        }
      }
    }, 5000); // 每 5 秒检查一次
  }

  /**
   * 处理分叉
   * 当收到一个不符合当前链的区块时触发
   * @param {Peer} peer - 来源 peer
   * @param {Block} newBlock - 新区块
   */
  _handleFork(peer, newBlock) {
    logger.warn(`Fork detected: peer ${peer.id} sent block #${newBlock.index} with different previousHash`);

    // TODO: 实现完整的分叉选择算法
    // 1. 追踪另一条链的分叉点
    // 2. 计算两条链的累计难度
    // 3. 选择难度更大的链作为 canonical chain
    // 4. 如果切换，重新组织交易池

    // 临时: 请求完整链同步
    this._requestFullSync(peer);
  }

  /**
   * 请求完整链同步
   * @param {Peer} peer
   */
  _requestFullSync(peer) {
    // 请求从高度 0 开始的所有区块（仅在小链情况）
    const localHeight = this.blockchain.chain.length;
    peer.send('get_blocks', {
      fromHeight: 0,
      limit: Math.min(localHeight, 1000)
    });
  }

  /**
   * 获取本地节点 ID（基于私钥或随机生成）
   * 注意: 生产环境应基于私钥派生出确定性 ID
   */
  _getLocalNodeId() {
    // TODO: 实现确定性 nodeId 生成（例如 SHA256(publicKey)）
    // 临时: 从区块链配置或环境变量读取
    const crypto = require('crypto');
    const seed = process.env.NODE_ID_SEED || 'default-seed-' + this.port;
    return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 40);
  }

  /**
   * 获取本地监听地址
   */
  _getLocalAddress() {
    const addresses = require('os').networkInterfaces();
    // 简单的获取第一个非 loopback IPv4 地址
    for (const name of Object.keys(addresses)) {
      for (const iface of addresses[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address + ':' + this.port;
        }
      }
    }
    return '127.0.0.1:' + this.port;
  }

  /**
   * 注册区块链事件钩子
   */
  _hookBlockchainEvents() {
    // 拦截 addTransaction，使用交易池管理
    const originalAddTransaction = this.blockchain.addTransaction.bind(this.blockchain);
    this.blockchain.addTransaction = (tx) => {
      // 先验证并加入交易池
      if (!this.transactionPool.add(tx)) {
        throw new Error('Transaction rejected by pool (duplicate or invalid)');
      }
      const result = originalAddTransaction(tx);
      this.broadcastTransaction(tx);
      return result;
    };

    const originalMineBlock = this.blockchain.mineBlock.bind(this.blockchain);
    this.blockchain.mineBlock = (minerAddress) => {
      const block = originalMineBlock(minerAddress);
      this.broadcastBlock(block, minerAddress);
      return block;
    };
  }

  /**
   * 获取网络统计信息
   */
  getStats() {
    return {
      port: this.port,
      totalPeers: this.peers.size,
      inboundCount: this.inboundCount,
      outboundCount: this.outboundCount,
      seedNodes: this.seedNodes.length,
      reconnectQueueSize: this.reconnectQueue.length,
      uptime: process.uptime()
    };
  }

  /**
   * 获取所有 peers 列表（调试用）
   */
  getPeersList() {
    return Array.from(this.peers.values()).map((p) => p.toJSON());
  }
}

module.exports = { P2PServer };
