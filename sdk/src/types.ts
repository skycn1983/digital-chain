/**
 * Digital Chain SDK - TypeScript Type Definitions
 */

// ==================== Client ====================

export interface ClientConfig {
  /** REST API endpoint URL (default: http://localhost:3000) */
  restUrl?: string;
  /** WebSocket endpoint URL (default: ws://localhost:3000) */
  wsUrl?: string;
  /** P2P port (optional, for direct network connection) */
  p2pPort?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export interface ChainInfo {
  blocks: number;
  pending: number;
  difficulty: number;
  reward: number;
  latestHash: string;
  valid: boolean;
}

export interface Block {
  index: number;
  hash: string;
  previousHash?: string;
  transactions: SerializedTransaction[] | number;  // 完整区块返回数组，mining 响应返回数量
  timestamp: number;
  nonce?: number;
  difficulty?: number;
  merkleRoot?: string;
}

export interface SerializedTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
  gasPrice: number;
  gasLimit: number;
  timestamp: number;
  signature?: string;
  publicKey?: string;
}

export interface TransactionResult {
  success: boolean;
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: number;
  chainLength: number;
  pendingTx: number;
}

export interface PendingTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  nonce: number;
}

export interface NetworkStats {
  port: number;
  totalPeers: number;
  inboundCount: number;
  outboundCount: number;
  seedNodes: number;
  reconnectQueueSize: number;
  uptime: number;
}

// ==================== Wallet ====================

export interface WalletInfo {
  address: string;
  publicKey: string;
}

export interface SignedTransaction {
  transaction: TransactionOptions & { timestamp: number; signature: string; publicKey: string };
  hash: string;
}

// ==================== Transaction ====================

export interface TransactionOptions {
  from: string;
  to: string;
  amount: number;
  gasPrice?: number;
  gasLimit?: number;
  data?: string;
  nonce?: number;
}

export interface CreateTransactionRequest {
  from: string;
  to: string;
  amount: number;
  gasPrice?: number;
  gasLimit?: number;
  privateKey: string;
}

// ==================== Mining ====================

export interface MineRequest {
  minerAddress: string;
}

export interface MineResult {
  success: boolean;
  block: {
    index: number;
    hash: string;
    transactions: number;
    timestamp: number;
  };
  stats: ChainInfo;
}

// ==================== Events ====================

export type ChainUpdateEvent = ChainInfo;
export type NewBlockEvent = Block;
export type NewTransactionEvent = SerializedTransaction;
export type ErrorEvent = DigitalChainError;

export type ClientEvent =
  | { type: 'chain_update'; data: ChainUpdateEvent }
  | { type: 'new_block'; data: NewBlockEvent }
  | { type: 'new_transaction'; data: NewTransactionEvent }
  | { type: 'error'; data: ErrorEvent }
  | { type: 'close' };

// ==================== Errors ====================

export class DigitalChainError extends Error {
  public code: string;
  public message: string;
  public details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.code = code;
    this.message = message;
    this.details = details;
    this.name = 'DigitalChainError';
  }
}

export const ERRORS = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  INVALID_NONCE: 'INVALID_NONCE',
  TRANSACTION_REJECTED: 'TRANSACTION_REJECTED',
  MINING_FAILED: 'MINING_FAILED',
  WEBSOCKET_CLOSED: 'WEBSOCKET_CLOSED',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_AMOUNT: 'INVALID_AMOUNT'
} as const;
