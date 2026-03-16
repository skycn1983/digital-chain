import { Block } from './block';
import { Transaction } from './transaction';
import { Wallet } from './wallet';
import * as fs from 'fs';
import * as path from 'path';

export interface ChainStats {
  blocks: number;
  pending: number;
  difficulty: number;
  reward: number;
  latestHash: string;
  valid: boolean;
}

export interface BlockchainConfig {
  difficulty?: number;
  blockReward?: number;
  dataDir?: string;
  chainFile?: string;
}

/**
 * Blockchain class - simplified version for SDK usage
 * Can connect to remote node via RPC or run local in-memory chain
 */
export class Blockchain {
  public chain: Block[] = [];
  public pendingTransactions: Transaction[] = [];
  public difficulty: number;
  public blockReward: number;
  public dataDir: string;
  public chainFile: string;
  private rpcUrl?: string;
  private wsUrl?: string;

  constructor(config: BlockchainConfig = {}) {
    this.difficulty = config.difficulty ?? 2;
    this.blockReward = config.blockReward ?? 50;
    this.dataDir = config.dataDir ?? path.join(process.cwd(), 'data');
    this.chainFile = config.chainFile ?? path.join(this.dataDir, 'chain.json');
    
    // If rpcUrl is set, operate in client mode (query remote node)
    // Otherwise, run local in-memory chain
  }

  /**
   * Create a new blockchain (local mode only)
   */
  createGenesisBlock() {
    const genesis = new Block(0, '0'.repeat(64), [], Date.now(), this.difficulty);
    genesis.mine();
    this.chain.push(genesis);
    this.save();
  }

  /**
   * Get latest block
   */
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Add transaction to pending pool (local mode)
   */
  addTransaction(tx: Transaction): Transaction {
    if (!tx.from || !tx.to || !tx.amount) {
      throw new Error('Invalid transaction');
    }

    const balance = this.getBalance(tx.from);
    const pendingFromSame = this.pendingTransactions
      .filter(t => t.from === tx.from)
      .reduce((sum, t) => sum + t.amount + (t.gasPrice * t.gasLimit), 0);

    if (balance - pendingFromSame < tx.amount) {
      throw new Error(`Insufficient balance: ${balance} available, need ${tx.amount + pendingFromSame}`);
    }

    this.pendingTransactions.push(tx);
    return tx;
  }

  /**
   * Mine a block (local mode)
   */
  mineBlock(minerAddress: string): Block {
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

  /**
   * Get balance for address (local mode)
   */
  getBalance(address: string): number {
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

  /**
   * Get nonce (transaction count) for address (local mode)
   */
  getNonce(address: string): number {
    let count = 0;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.from === address) count++;
      }
    }
    return count;
  }

  /**
   * Validate chain integrity (local mode)
   */
  isValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const curr = this.chain[i];
      const prev = this.chain[i - 1];

      if (curr.previousHash !== prev.hash) return false;
      if (curr.hash !== curr.calculateHash()) return false;
      if (!curr.hash.startsWith('0'.repeat(curr.difficulty))) return false;
    }
    return true;
  }

  /**
   * Get chain statistics (local mode)
   */
  getStats(): ChainStats {
    return {
      blocks: this.chain.length,
      pending: this.pendingTransactions.length,
      difficulty: this.difficulty,
      reward: this.blockReward,
      latestHash: this.getLatestBlock().hash,
      valid: this.isValid()
    };
  }

  /**
   * Save chain to disk (local mode)
   */
  save() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const data = {
      chain: this.chain.map(b => b.serialize()),
      pending: this.pendingTransactions.map(t => t.serialize()),
      difficulty: this.difficulty,
      blockReward: this.blockReward
    };
    fs.writeFileSync(this.chainFile, JSON.stringify(data, null, 2));
  }

  /**
   * Load chain from disk (local mode)
   */
  load() {
    if (fs.existsSync(this.chainFile)) {
      try {
        const rawData = fs.readFileSync(this.chainFile, 'utf8');
        const data = JSON.parse(rawData) as {
          chain: any[];
          pending: any[];
          difficulty?: number;
          blockReward?: number;
        };
        this.chain = data.chain.map(b => Block.deserialize(b));
        this.pendingTransactions = data.pending.map(t => Transaction.deserialize(t));
        this.difficulty = data.difficulty ?? this.difficulty;
        this.blockReward = data.blockReward ?? this.blockReward;
        console.log(`📂 Loaded ${this.chain.length} blocks`);
      } catch (e: any) {
        console.error('Load failed:', e.message);
        this.createGenesisBlock();
      }
    } else {
      this.createGenesisBlock();
    }
  }

  // ============== RPC Client Methods ==============

  /**
   * Set RPC endpoint (for remote node queries)
   */
  setRpcUrl(url: string) {
    this.rpcUrl = url;
  }

  /**
   * Set WebSocket endpoint (for real-time events)
   */
  setWebSocketUrl(url: string) {
    this.wsUrl = url;
  }

  /**
   * Query remote node for balance
   */
  async getBalanceRemote(address: string): Promise<number> {
    if (!this.rpcUrl) throw new Error('RPC URL not set');
    const res = await fetch(`${this.rpcUrl}/balance/${address}`);
    const data = await res.json() as { error?: string; balance: number };
    if (data.error) throw new Error(data.error);
    return data.balance;
  }

  /**
   * Query remote node for nonce
   */
  async getNonceRemote(address: string): Promise<number> {
    if (!this.rpcUrl) throw new Error('RPC URL not set');
    const res = await fetch(`${this.rpcUrl}/nonce/${address}`);
    const data = await res.json() as { error?: string; nonce: number };
    if (data.error) throw new Error(data.error);
    return data.nonce;
  }

  /**
   * Submit transaction to remote node
   */
  async sendTransactionRemote(
    from: string,
    to: string,
    amount: number,
    gasPrice?: number,
    gasLimit?: number
  ): Promise<{ hash: string; nonce: number }> {
    if (!this.rpcUrl) throw new Error('RPC URL not set');
    const res = await fetch(`${this.rpcUrl}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, amount, gasPrice, gasLimit })
    });
    const data = await res.json() as { error?: string; hash: string; nonce: number };
    if (data.error) throw new Error(data.error);
    return { hash: data.hash, nonce: data.nonce };
  }

  /**
   * Mine block on remote node
   */
  async mineBlockRemote(minerAddress: string): Promise<Block> {
    if (!this.rpcUrl) throw new Error('RPC URL not set');
    const res = await fetch(`${this.rpcUrl}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minerAddress })
    });
    const data = await res.json() as { error?: string; block: any };
    if (data.error) throw new Error(data.error);
    return Block.deserialize(data.block);
  }

  /**
   * Get remote chain info
   */
  async getChainRemote(): Promise<{ stats: ChainStats; latestBlock: any }> {
    if (!this.rpcUrl) throw new Error('RPC URL not set');
    const res = await fetch(`${this.rpcUrl}/chain`);
    const data = await res.json() as { error?: string; stats: ChainStats; latestBlock: any };
    if (data.error) throw new Error(data.error);
    return data;
  }
}
