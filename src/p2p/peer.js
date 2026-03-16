/**
 * Peer 类 - 代表一个远程对等节点
 */

const { v4: uuidv4 } = require('uuid');

class Peer {
  /**
   * 创建 Peer 实例
   * @param {net.Socket} socket - TCP socket
   * @param {string} address - 地址 "ip:port"
   * @param {Object} handshakeData - handshake 消息内容
   */
  constructor(socket, address, handshakeData) {
    this.id = handshakeData.nodeId || uuidv4();
    this.socket = socket;
    this.address = address; // 远程地址
    this.localAddress = socket.localAddress + ':' + socket.localPort;

    // 握手信息
    this.protocolVersion = handshakeData.protocolVersion;
    this.userAgent = handshakeData.userAgent;
    this.chainHeight = handshakeData.chainHeight;
    this.difficulty = handshakeData.difficulty;
    this.blockReward = handshakeData.blockReward;

    // 状态
    this.connectedAt = Date.now();
    this.lastPing = Date.now();
    this.pingRtt = null;
    this.isOutbound = handshakeData._outbound || false; // 是否为出站连接

    // 统计
    this.messagesReceived = 0;
    this.messagesSent = 0;
    this.bytesReceived = 0;
    this.bytesSent = 0;

    // 事件监听器
    this.onMessage = null;      // (type, payload) => void
    this.onClose = null;        // () => void
    this.onError = null;        // (err) => void

    // 绑定 socket 事件
    this._bindSocketEvents();
  }

  _bindSocketEvents() {
    this.socket.on('data', (buffer) => {
      this.bytesReceived += buffer.length;
      // 注意: 实际消息处理在 P2PServer 中
    });

    this.socket.on('close', (hadError) => {
      this._emitClose();
    });

    this.socket.on('error', (err) => {
      this._emitError(err);
    });

    this.socket.on('end', () => {
      // 对方正常关闭，等待 close 事件
    });
  }

  /**
   * 发送消息
   * @param {string} type - 消息类型
   * @param {Object} payload - 消息体
   */
  send(type, payload) {
    const message = {
      type,
      payload,
      timestamp: Date.now(),
      nodeId: this.id // 可选，用于追踪
    };

    const buffer = require('./message').encode(message);
    this.socket.write(buffer);
    this.messagesSent++;
    this.bytesSent += buffer.length;
  }

  /**
   * 发送 ping
   * @param {number} nonce
   */
  ping(nonce) {
    this.send('ping', { nonce });
    this.lastPing = Date.now();
  }

  /**
   * 发送 pong
   * @param {number} nonce
   */
  pong(nonce) {
    this.send('pong', { nonce });
  }

  /**
   * 关闭连接
   */
  disconnect() {
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }

  /**
   * 获取连接时长（毫秒）
   */
  getUptime() {
    return Date.now() - this.connectedAt;
  }

  /**
   * 序列化为可 JSON 对象（用于调试/日志）
   */
  toJSON() {
    return {
      id: this.id,
      address: this.address,
      localAddress: this.localAddress,
      protocolVersion: this.protocolVersion,
      userAgent: this.userAgent,
      chainHeight: this.chainHeight,
      difficulty: this.difficulty,
      blockReward: this.blockReward,
      connectedAt: this.connectedAt,
      uptime: this.getUptime(),
      isOutbound: this.isOutbound,
      lastPing: this.lastPing,
      pingRtt: this.pingRtt,
      messagesReceived: this.messagesReceived,
      messagesSent: this.messagesSent,
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent
    };
  }

  _emitClose() {
    if (this.onClose) {
      this.onClose(this);
    }
  }

  _emitError(err) {
    if (this.onError) {
      this.onError(err, this);
    }
  }
}

module.exports = { Peer };
