const { Block } = require('./block');
const { Transaction } = require('./transaction');
const fs = require('fs');
const path = require('path');

class Blockchain {
  constructor(difficulty = 2, blockReward = 50, dataDir = null) {
    this.chain = [];
    this.pendingTransactions = [];
    this.difficulty = difficulty;
    this.blockReward = blockReward;
    this.dataDir = dataDir || path.join(__dirname, '..', 'data');
    this.chainFile = path.join(this.dataDir, 'chain.json');

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.load();
  }

  createGenesisBlock() {
    const genesis = new Block(0, '0'.repeat(64), [], Date.now(), this.difficulty);
    genesis.mine();
    this.chain.push(genesis);
    this.save();
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(tx) {
    if (!tx.from || !tx.to || !tx.amount) {
      throw new Error('Invalid transaction');
    }

    // 检查 pending 中是否已有相同 (from, nonce) 的交易（防重放）
    const existing = this.pendingTransactions.find(t => t.from === tx.from && t.nonce === tx.nonce);
    if (existing) {
      throw new Error(`Duplicate nonce ${tx.nonce} for sender ${tx.from}`);
    }

    // Check balance (excluding gas for simplicity)
    const balance = this.getBalance(tx.from);
    // Also account for pending transactions from same sender
    const pendingFromSame = this.pendingTransactions
      .filter(t => t.from === tx.from)
      .reduce((sum, t) => sum + t.amount + (t.gasPrice * t.gasLimit), 0);

    if (balance - pendingFromSame < tx.amount) {
      throw new Error(`Insufficient balance: ${balance} available, need ${tx.amount + pendingFromSame}`);
    }

    this.pendingTransactions.push(tx);
    return tx;
  }

  mineBlock(minerAddress) {
    // Coinbase
    const coinbase = new Transaction(
      '0x0000000000000000000000000000000000000000',
      minerAddress,
      this.blockReward,
      0, 0, 0
    );
    coinbase.signature = 'coinbase';

    const txs = [coinbase, ...this.pendingTransactions];

    const newBlock = new Block(
      this.chain.length,
      this.getLatestBlock().hash,
      txs,
      Date.now(),
      this.difficulty
    );

    newBlock.mine();
    this.chain.push(newBlock);
    this.pendingTransactions = [];
    this.save();

    return newBlock;
  }

  isValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];

      if (curr.previousHash !== prev.hash) return false;
      if (curr.hash !== curr.calculateHash()) return false;
      if (!curr.hash.startsWith('0'.repeat(curr.difficulty))) return false;
    }
    return true;
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === '0x0000000000000000000000000000000000000000') {
          if (tx.to === address) balance += tx.amount;
        } else {
          if (tx.from === address) {
            balance -= tx.amount;
            balance -= tx.gasPrice * tx.gasLimit;
          }
          if (tx.to === address) balance += tx.amount;
        }
      }
    }
    return Math.max(0, balance);
  }

  getNonce(address) {
    let count = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) count++;
      }
    }
    return count;
  }

  save() {
    const data = {
      chain: this.chain.map(b => b.serialize()),
      pending: this.pendingTransactions.map(t => t.serialize()),
      difficulty: this.difficulty,
      blockReward: this.blockReward
    };
    fs.writeFileSync(this.chainFile, JSON.stringify(data, null, 2));
  }

  load() {
    if (fs.existsSync(this.chainFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.chainFile, 'utf8'));
        this.chain = data.chain.map(b => Block.deserialize(b));
        this.pendingTransactions = data.pending.map(t => Transaction.deserialize(t));
        this.difficulty = data.difficulty || this.difficulty;
        this.blockReward = data.blockReward || this.blockReward;
        console.log(`📂 Loaded ${this.chain.length} blocks`);
      } catch (e) {
        console.error('Load failed:', e.message);
        this.createGenesisBlock();
      }
    } else {
      this.createGenesisBlock();
    }
  }

  getStats() {
    return {
      blocks: this.chain.length,
      pending: this.pendingTransactions.length,
      difficulty: this.difficulty,
      reward: this.blockReward,
      latestHash: this.getLatestBlock().hash,
      valid: this.isValid()
    };
  }

  // 简单难度调整 (每10个区块检查一次)
  adjustDifficulty() {
    if (this.chain.length % 10 !== 0 || this.chain.length < 10) return;

    try {
      const recent = this.chain.slice(-10);
      const timeSpan = (recent[9].timestamp - recent[0].timestamp) / 1000;
      const expected = 600; // 10 blocks * 60 seconds
      const ratio = timeSpan / expected;

      if (ratio < 0.9 && this.difficulty < 8) {
        this.difficulty++;
      } else if (ratio > 1.1 && this.difficulty > 1) {
        this.difficulty--;
      }
    } catch (e) {
      // Ignore errors
    }
  }
}

module.exports = { Blockchain };