/**
 * 分叉选择算法
 * 基于最长链原则 + 累计难度
 */

class ForkChoice {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.orphans = new Map(); // blockHash -> Block (孤儿区块)
    this.maxOrphans = 100;     // 最大孤儿区块数
  }

  /**
   * 添加新区块，处理分叉
   * @param {Block} newBlock
   * @returns {Object} { accepted, switched, canonicalChain }
   */
  addBlock(newBlock) {
    // 基础验证
    if (!newBlock.hash || !newBlock.previousHash) {
      console.warn(`Fork choice: invalid block structure`);
      return { accepted: false, switched: false };
    }

    // 验证哈希计算
    if (newBlock.hash !== newBlock.calculateHash()) {
      console.warn(`Fork choice: block hash mismatch (expected ${newBlock.calculateHash().substring(0,16)}..., got ${newBlock.hash.substring(0,16)}...)`);
      return { accepted: false, switched: false };
    }

    const currentHead = this.blockchain.getLatestBlock();

    // 情况 0: 新节点完全替换（包括创世块）
    // 如果收到 index=0 的区块（创世块），且当前链也有创世块但 hash 不同
    // 这表示两个不同的创世块，应该完全替换链
    if (newBlock.index === 0 && this.blockchain.chain.length > 0) {
      const localGenesis = this.blockchain.chain[0];
      if (newBlock.hash !== localGenesis.hash) {
        console.log(`🔄 Replacing local genesis block with peer's genesis`);
        // 完全清空链并添加新区块（作为新的创世块）
        this.blockchain.chain = [newBlock];
        this.blockchain.save();
        this.blockchain.adjustDifficulty();
        return { accepted: true, switched: true, canonicalChain: this.blockchain.chain };
      }
    }

    // 情况 0b: 新节点完全替换（创世块不同但区块从 index=1 开始）
    // 如果本地只有创世块，且新区块 index=1 但 previousHash 不匹配本地创世块
    if (this.blockchain.chain.length === 1 && newBlock.index === 1 && newBlock.previousHash !== currentHead.hash) {
      console.log(`🔄 Full chain replacement: replacing genesis with peer's chain (fork at height 0)`);
      // 清空本地链（包括创世块），等待后续区块构建完整链
      // 将新区块暂存为孤儿，同时请求完整链
      this._addOrphan(newBlock);
      return { accepted: false, switched: false, needsFullSync: true };
    }

    // 情况 1: 新区块是当前链的直接延伸
    if (newBlock.previousHash === currentHead.hash) {
      this.blockchain.chain.push(newBlock);
      this._cleanupOrphans(newBlock);
      this.blockchain.adjustDifficulty();
      return { accepted: true, switched: false, canonicalChain: this.blockchain.chain };
    }

    // 情况 2: 新区块是从某个历史分叉点开始
    const forkPoint = this._findForkPoint(newBlock);

    if (!forkPoint) {
      // 特殊处理：新节点完全替换场景
      // 如果本地只有创世块（长度=1）且新区块 index=1，说明对方有不同创世块
      if (this.blockchain.chain.length === 1 && newBlock.index === 1) {
        console.log(`🔄 New node full sync needed: local genesis != peer's previousHash for block #1`);
        // 暂存为孤儿，等待完整链同步
        this._addOrphan(newBlock);
        return { accepted: false, switched: false, needsFullSync: true };
      }
      
      console.warn(`Fork choice: no common ancestor for block #${newBlock.index}`);
      // 存储为孤儿，可能需要完整同步
      this._addOrphan(newBlock);
      return { accepted: false, switched: false };
    }

    // 计算两条链的累计难度
    const currentChainDifficulty = this._calculateCumulativeDifficulty(currentHead, forkPoint);
    const newChainDifficulty = this._calculateCumulativeDifficulty(newBlock, forkPoint);

    console.log(`Fork choice: current=${currentChainDifficulty}, new=${newChainDifficulty}`);

    // 选择累计难度更大的链
    if (newChainDifficulty > currentChainDifficulty) {
      return this._switchToFork(newBlock, forkPoint);
    } else {
      // 保持当前链，新区块成为孤儿
      this._addOrphan(newBlock);
      return { accepted: false, switched: false };
    }
  }

  /**
   * 寻找分叉点（两条链的共同祖先）
   * @param {Block} newBlock
   * @returns {Block|null}
   */
  _findForkPoint(newBlock) {
    // 遍历当前链，找到与新区块 previousHash 匹配的区块
    for (let i = this.blockchain.chain.length - 1; i >= 0; i--) {
      if (this.blockchain.chain[i].hash === newBlock.previousHash) {
        return this.blockchain.chain[i];
      }
    }
    return null;
  }

  /**
   * 计算从分叉点到指定区块的累计难度
   * @param {Block} block
   * @param {Block} forkPoint
   * @returns {number}
   */
  _calculateCumulativeDifficulty(block, forkPoint) {
    let difficulty = 0;
    let current = block;

    while (current && current.index !== undefined && current.index >= forkPoint.index) {
      difficulty += current.difficulty;
      // 查找上一个区块（可能在链上或孤儿池中）
      if (current.index === 0) break;

      if (current.previousHash === forkPoint.hash) {
        break;
      }

      // 在孤儿池中查找
      current = this.orphans.get(current.previousHash) ||
                this.blockchain.chain.find(b => b.hash === current.previousHash);
    }

    return difficulty;
  }

  /**
   * 切换到分叉链（重组区块链）
   * @param {Block} newBlock - 新区块（新链的 head）
   * @param {Block} forkPoint - 分叉点
   * @returns {Object}
   */
  _switchToFork(newBlock, forkPoint) {
    const forkIndex = forkPoint.index;

    console.log(`🔀 Switching to fork at block ${forkIndex}, new head #${newBlock.index}`);

    // 1. 收集需要回滚的区块（从分叉点到当前 head）
    const toRollback = this.blockchain.chain.slice(forkIndex + 1);

    // 2. 收集新链上需要添加的区块（从分叉点+1 到 newBlock）
    const newChainBlocks = [];
    let current = newBlock;
    while (current && current.index !== undefined && current.index > forkIndex) {
      newChainBlocks.unshift(current);
      const prev = current.previousHash;
      // 尝试在孤儿池或当前链中查找上一个区块
      current = this.orphans.get(prev) ||
                (prev ? this.blockchain.chain.find(b => b.hash === prev) : null);
    }

    // 3. 回滚交易（将交易放回 pending pool）
    for (const block of toRollback) {
      for (const tx of block.transactions) {
        // 跳过 coinbase
        if (tx.from === '0x0000000000000000000000000000000000000000') {
          continue;
        }
        // 重新加入 pending pool（如果不在新链区块中）
        if (!newChainBlocks.some(b => b.transactions.some(t => t.getHash() === tx.getHash()))) {
          this.blockchain.pendingTransactions.push(tx);
        }
      }
    }

    // 4. 替换链：如果分叉点不是创世块（index > 0），保留分叉点之前的区块
    if (forkIndex > 0) {
      this.blockchain.chain = this.blockchain.chain.slice(0, forkIndex + 1);
    } else {
      // 分叉点是创世块（index 0）但创世块本身不同，需要完全替换
      // 清空链（包括创世块），完全采用新链
      this.blockchain.chain = [];
    }
    
    // 添加新链区块
    for (const block of newChainBlocks) {
      this.blockchain.chain.push(block);
    }

    // 5. 清理已处理的孤儿区块
    for (const block of newChainBlocks) {
      this.orphans.delete(block.hash);
    }

    // 6. 保存和调整难度
    this.blockchain.save();
    this.blockchain.adjustDifficulty();

    console.log(`🔀 Chain switched: new height ${this.blockchain.chain.length}`);

    return {
      accepted: true,
      switched: true,
      canonicalChain: this.blockchain.chain,
      rolledBack: toRollback.length,
      added: newChainBlocks.length
    };
  }

  /**
   * 添加孤儿区块
   * @param {Block} block
   */
  _addOrphan(block) {
    if (this.orphans.size >= this.maxOrphans) {
      // 淘汰最旧的孤儿区块
      const oldest = this.orphans.keys().next().value;
      this.orphans.delete(oldest);
    }

    this.orphans.set(block.hash, block);
  }

  /**
   * 清理孤儿区块（移除已被主链包含的）
   * @param {Block} block - 新添加到主链的区块
   */
  _cleanupOrphans(block) {
    // 如果某个孤儿的 previousHash 等于这个区块的 hash，说明它可能是下一区块
    // 尝试将这些孤儿链接起来
    const toCheck = Array.from(this.orphans.values()).filter(o => o.previousHash === block.hash);
    // 暂时不做自动链接，等待更多区块
  }

  /**
   * 获取孤儿区块列表
   */
  getOrphans() {
    return Array.from(this.orphans.values());
  }

  /**
   * 根据 hash 获取孤儿区块
   */
  getOrphan(hash) {
    return this.orphans.get(hash);
  }

  /**
   * 尝试将孤儿区块连接到主链
   * 返回成功连接的数量
   */
  tryConnectOrphans() {
    let connected = 0;
    const toConnect = [];

    for (const orphan of this.orphans.values()) {
      if (orphan.previousHash === this.blockchain.getLatestBlock().hash) {
        toConnect.push(orphan);
      }
    }

    for (const block of toConnect) {
      this.blockchain.chain.push(block);
      this.orphans.delete(block.hash);
      this.blockchain.save();
      connected++;
    }

    return connected;
  }
}

module.exports = { ForkChoice };
