/**
 * mDNS 局域网节点发现
 * 使用 multicast DNS (UDP 30002) 广播和发现本地节点
 */

const dgram = require('dgram');
const crypto = require('crypto');

const MDNS_PORT = 30002;
const MDNS_GROUP = '224.0.0.251'; // mDNS IPv4 multicast group
const ANNOUNCE_INTERVAL = 60000; // 60 秒广播一次
const PEER_TTL = 300000; // 5 分钟 TTL

class MDNSDiscovery {
  constructor(p2pServer, options = {}) {
    this.p2p = p2pServer;
    // 基于 P2P 端口计算 mDNS 端口（P2P 端口 + 1），避免多节点冲突
    this.port = options.port || (p2pServer.port + 1);
    this.interval = options.interval || ANNOUNCE_INTERVAL;
    this.ttl = options.ttl || PEER_TTL;

    this.socket = null;
    this.announceTimer = null;
    this.knownPeers = new Map(); // nodeId -> { address, lastSeen, info }
  }

  /**
   * 启动 mDNS 发现
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        // 创建 UDP socket
        this.socket = dgram.createSocket('udp4');

        this.socket.on('message', (msg, rinfo) => {
          this._handleMessage(msg, rinfo);
        });

        this.socket.on('error', (err) => {
          console.error('MDNS socket error:', err.message);
        });

        this.socket.on('listening', () => {
          console.log(`🔍 mDNS listening on port ${this.port}`);

          // 设置多播组
          this.socket.addMembership(MDNS_GROUP);

          // 开始定期广播
          this._startAnnounceTimer();

          resolve();
        });

        this.socket.bind(this.port, '0.0.0.0');

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 停止 mDNS 发现
   */
  stop() {
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }

    if (this.socket && !this.socket.destroyed) {
      this.socket.close();
    }

    this.knownPeers.clear();
  }

  /**
   * 处理收到的 mDNS 消息
   * @param {Buffer} msg
   * @param {Object} rinfo - remote info { address, port, family, size }
   */
  _handleMessage(msg, rinfo) {
    try {
      const data = JSON.parse(msg.toString('utf8'));

      if (data.type !== 'mdns_announce') {
        return;
      }

      const { nodeId, address, chainHeight, protocolVersion } = data;
      const peerKey = nodeId + '@' + address;

      // 忽略自己
      const localNodeId = this.p2p._getLocalNodeId();
      if (nodeId === localNodeId) {
        return;
      }

      // 如果已经连接到这个节点，跳过
      if (this.p2p.peersByAddress.has(address)) {
        return;
      }

      // 更新已知节点信息
      this.knownPeers.set(peerKey, {
        nodeId,
        address,
        chainHeight,
        protocolVersion,
        lastSeen: Date.now()
      });

      console.log(`🔍 mDNS discovered peer: ${nodeId} at ${address} (height=${chainHeight})`);

      // 延迟后尝试连接（避免同时爆发连接）
      this._scheduleConnect(address, 1000 + Math.random() * 2000);

    } catch (e) {
      // 忽略无效消息
    }
  }

  /**
   * 调度连接尝试
   * @param {string} address
   * @param {number} delay
   */
  _scheduleConnect(address, delay) {
    // 检查是否已经计划连接
    if (this.p2p.reconnectQueue.some(q => q.address === address)) {
      return;
    }

    setTimeout(() => {
      this.p2p.connect(address).catch((err) => {
        console.debug(`🔍 mDNS connect to ${address} failed:`, err.message);
      });
    }, delay);
  }

  /**
   * 广播本节点信息
   */
  _announce() {
    const localNodeId = this.p2p._getLocalNodeId();
    const localAddress = this.p2p._getLocalAddress();
    const chainHeight = this.p2p.blockchain.chain.length;

    const announce = {
      type: 'mdns_announce',
      nodeId: localNodeId,
      address: localAddress,
      chainHeight,
      protocolVersion: '0.1',
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(announce), 'utf8');

    // 广播到多播组
    this.socket.send(buffer, 0, buffer.length, this.port, MDNS_GROUP, (err) => {
      if (err) {
        console.error('MDNS announce failed:', err.message);
      }
    });

    console.debug(`🔍 mDNS announced: ${localNodeId}@${localAddress} (h=${chainHeight})`);

    // 清理过期节点
    this._cleanupStalePeers();
  }

  /**
   * 开始定时广播
   */
  _startAnnounceTimer() {
    this.announceTimer = setInterval(() => {
      this._announce();
    }, this.interval);

    // 立即广播一次
    this._announce();
  }

  /**
   * 清理长时间未响应的节点
   */
  _cleanupStalePeers() {
    const now = Date.now();
    for (const [key, peer] of this.knownPeers) {
      if (now - peer.lastSeen > this.ttl) {
        this.knownPeers.delete(key);
      }
    }
  }

  /**
   * 获取已知节点列表
   */
  getKnownPeers() {
    return Array.from(this.knownPeers.values());
  }
}

module.exports = { MDNSDiscovery };
