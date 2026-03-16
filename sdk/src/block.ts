import { Transaction } from './transaction';
import { sha256 } from './wallet';

/**
 * Block class representing a blockchain block
 */
export class Block {
  public readonly index: number;
  public readonly previousHash: string;
  public readonly transactions: Transaction[];
  public readonly timestamp: number;
  public readonly difficulty: number;
  public nonce: number;
  public hash: string;
  private _merkleRoot: string;

  constructor(
    index: number,
    previousHash: string,
    transactions: Transaction[] = [],
    timestamp: number = Date.now(),
    difficulty: number = 2,
    nonce: number = 0,
    hash?: string,
    merkleRoot?: string
  ) {
    this.index = index;
    this.previousHash = previousHash;
    this.transactions = transactions;
    this.timestamp = timestamp;
    this.difficulty = difficulty;
    this.nonce = nonce;
    this._merkleRoot = merkleRoot ?? this.calculateMerkleRoot();
    this.hash = hash ?? this.calculateHash();
  }

  get merkleRoot(): string {
    return this._merkleRoot;
  }

  /**
   * Calculate block hash including nonce
   */
  calculateHash(): string {
    const blockData = {
      index: this.index,
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      timestamp: this.timestamp,
      difficulty: this.difficulty,
      nonce: this.nonce
    };
    return sha256(JSON.stringify(blockData));
  }

  /**
   * Calculate Merkle root of all transactions
   */
  calculateMerkleRoot(): string {
    if (this.transactions.length === 0) {
      return sha256('empty');
    }

    let hashes = this.transactions.map(tx => tx.getHash());

    while (hashes.length > 1) {
      if (hashes.length % 2 !== 0) {
        hashes.push(hashes[hashes.length - 1]);
      }

      const newHashes: string[] = [];
      for (let i = 0; i < hashes.length; i += 2) {
        const combined = hashes[i] + hashes[i + 1];
        newHashes.push(sha256(combined));
      }
      hashes = newHashes;
    }

    return hashes[0];
  }

  /**
   * Proof of Work mining
   */
  mine(maxIterations: number = 10000000): string {
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

      if (iterations >= maxIterations) {
        console.log(`⚠️ Mining limit reached, accepting hash: ${this.hash}`);
        return this.hash;
      }
    }
  }

  /**
   * Serialize block
   */
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

  /**
   * Deserialize from plain object
   */
  static deserialize(data: any): Block {
    return new Block(
      data.index,
      data.previousHash,
      data.transactions.map((txData: any) => Transaction.deserialize(txData)),
      data.timestamp,
      data.difficulty,
      data.nonce,
      data.hash,
      data.merkleRoot
    );
  }
}
