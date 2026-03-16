/**
 * 交易池管理器
 * 功能：交易去重、LRU 淘汰、广播频率限制、验证缓存
 */

const { LRUCache } = require('lru-cache');

class TransactionPool {
  constructor(blockchain, options = {}) {
    this.blockchain = blockchain;

    // 配置
    this.maxSize = options.maxSize || 10000; // 最大交易数
    this.minFee = options.minFee || 1;       // 最小 Gas 费
    this.minAmount = options.minAmount || 1; // 最小交易金额
    this.broadcastInterval = options.broadcastInterval || 5000; // 广播去重时间窗口

    // LRU 缓存 (txHash -> Transaction)
    this.pool = new LRUCache({
      max: this.maxSize,
      ttl: 1000 * 60 * 60, // 1 小时 TTL
      allowStale: false
    });

    // 广播历史 (txHash -> lastBroadcastTime)
    this.broadcastHistory = new Map();

    // 统计
    this.stats = {
      accepted: 0,
      rejected: 0,
      duplicates: 0,
      expired: 0
    };
  }

  /**
   * 添加交易到池子
   * @param {Transaction} tx
   * @returns {boolean} true if added, false if rejected
   */
  add(tx) {
    const hash = tx.getHash();

    // 检查是否已存在
    if (this.pool.has(hash)) {
      this.stats.duplicates++;
      return false;
    }

    // 验证交易
    if (!this._validate(tx)) {
      this.stats.rejected++;
      return false;
    }

    // 加入池子
    this.pool.set(hash, tx);
    this.stats.accepted++;

    // 记录广播时间
    this.broadcastHistory.set(hash, Date.now());

    return true;
  }

  /**
   * 批量添加交易
   * @param {Transaction[]} txs
   * @returns {number} number of accepted transactions
   */
  addBatch(txs) {
    let accepted = 0;
    for (const tx of txs) {
      if (this.add(tx)) {
        accepted++;
      }
    }
    return accepted;
  }

  /**
   * 获取交易
   * @param {string} hash
   */
  get(hash) {
    return this.pool.get(hash);
  }

  /**
   * 移除交易
   * @param {string} hash
   */
  remove(hash) {
    this.pool.delete(hash);
    this.broadcastHistory.delete(hash);
  }

  /**
   * 获取所有交易（按 LRU 顺序）
   */
  getAll() {
    return Array.from(this.pool.values());
  }

  /**
   * 清空池子
   */
  clear() {
    this.pool.clear();
    this.broadcastHistory.clear();
  }

  /**
   * 验证交易（基础检查）
   * @param {Transaction} tx
   */
  _validate(tx) {
    // 金额检查
    if (tx.amount < this.minAmount) {
      return false;
    }

    // Gas 费检查
    const fee = tx.gasPrice * tx.gasLimit;
    if (fee < this.minFee) {
      return false;
    }

    // 必填字段
    if (!tx.from || !tx.to || !tx.amount) {
      return false;
    }

    // 签名检查（如果包含 signature）
    if (tx.signature && !tx.publicKey) {
      return false; // 有签名必须有公钥
    }

    return true;
  }

  /**
   * 检查是否需要广播该交易
   * 避免短时间内重复广播同一交易
   * @param {string} txHash
   * @returns {boolean}
   */
  shouldBroadcast(txHash) {
    const lastTime = this.broadcastHistory.get(txHash);
    if (!lastTime) {
      return true; // 从未广播过
    }

    const now = Date.now();
    if (now - lastTime > this.broadcastInterval) {
      return true; // 超过时间窗口，可以再次广播
    }

    return false;
  }

  /**
   * 标记交易已广播（更新广播时间）
   * @param {string} txHash
   */
  markBroadcasted(txHash) {
    this.broadcastHistory.set(txHash, Date.now());
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      size: this.pool.size,
      maxSize: this.maxSize,
      accepted: this.stats.accepted,
      rejected: this.stats.rejected,
      duplicates: this.stats.duplicates,
      expired: this.stats.expired
    };
  }

  /**
   * 执行 LRU 淘汰（当池子满时）
   * @returns {Transaction[]} 被淘汰的交易
   */
  evictLRU() {
    if (this.pool.size < this.maxSize) {
      return [];
    }

    // LRU 库会自动淘汰最久未使用的项目
    // 这里可以手动触发一次清理
    const evicted = [];

    // 检查是否有过期交易（在 pending 中时间过长）
    const now = Date.now();
    const maxAge = 1000 * 60 * 30; // 30 分钟

    for (const [hash, tx] of this.pool.entries()) {
      if (now - tx.timestamp > maxAge) {
        evicted.push(tx);
        this.pool.delete(hash);
      }
    }

    return evicted;
  }
}

module.exports = { TransactionPool };
