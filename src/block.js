const { sha256 } = require('./crypto');
const { Transaction } = require('./transaction');

class Block {
  constructor(index, previousHash, transactions = [], timestamp = null, difficulty = 2) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.timestamp = timestamp || Date.now();
    this.difficulty = difficulty;
    this.nonce = 0;
    this.merkleRoot = this.calculateMerkleRoot();
    this.hash = this.calculateHash();
  }

  // Calculate block hash including nonce
  calculateHash() {
    const blockData = {
      index: this.index,
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce
    };
    const hash = sha256(JSON.stringify(blockData));
    // Debug: console.log(`Hash for nonce ${this.nonce}: ${hash.substring(0, 10)}...`);
    return hash;
  }

  // Calculate Merkle root of all transactions
  calculateMerkleRoot() {
    if (this.transactions.length === 0) {
      return sha256('empty');
    }

    // Build transaction hashes
    let hashes = this.transactions.map(tx => tx.getHash());

    // Combine hashes until one remains
    while (hashes.length > 1) {
      if (hashes.length % 2 !== 0) {
        hashes.push(hashes[hashes.length - 1]); // duplicate last if odd
      }

      const newHashes = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const combined = hashes[i] + hashes[i + 1];
        newHashes.push(sha256(combined));
      }
      hashes = newHashes;
    }

    return hashes[0];
  }

  // Proof of Work mining
  mine() {
    const target = '0'.repeat(this.difficulty);
    const startTime = Date.now();
    let iterations = 0;

    while (true) {
      this.hash = this.calculateHash();
      iterations++;

      if (this.hash.startsWith(target)) {
        const duration = (Date.now() - startTime) / 1000;
        console.log(`✅ Block ${this.index} mined (${iterations} iters, ${duration.toFixed(3)}s)`);
        return this.hash;
      }

      this.nonce++;

      if (iterations > 10000000) {
        console.log(`⚠️ Mining limit reached, accepting hash: ${this.hash}`);
        return this.hash;
      }
    }
  }

  // Serialize block
  serialize() {
    return {
      index: this.index,
      previousHash: this.previousHash,
      transactions: this.transactions.map(tx => tx.serialize()),
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce,
      hash: this.hash,
      merkleRoot: this.merkleRoot
    };
  }

  static deserialize(data) {
    const block = new Block(
      data.index,
      data.previousHash,
      data.transactions.map(txData => Transaction.deserialize(txData)),
      data.timestamp,
      data.difficulty
    );
    block.nonce = data.nonce;
    block.hash = data.hash;
    block.merkleRoot = data.merkleRoot;
    return block;
  }
}

module.exports = { Block };