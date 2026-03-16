/**
 * DigitalChainClient - Main SDK entry point
 * Combines REST API and WebSocket functionality
 */

import { Wallet } from './wallet';
import { Transaction } from './transaction';
import {
  ClientConfig,
  ChainInfo,
  Block,
  TransactionResult,
  HealthStatus,
  PendingTransaction,
  NetworkStats,
  ClientEvent,
  DigitalChainError,
  ERRORS,
  MineResult,
  SerializedTransaction
} from './types';
import { DEFAULT_REST_URL, DEFAULT_WS_URL, API_ENDPOINTS, DEFAULT_TIMEOUT } from './constants';

export class DigitalChainClient {
  private restUrl: string;
  private wsUrl: string;
  private timeout: number;
  private ws: any | null = null;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: ClientConfig = {}) {
    this.restUrl = config.restUrl ?? DEFAULT_REST_URL;
    this.wsUrl = config.wsUrl ?? DEFAULT_WS_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  // ==================== Wallet ====================

  createWallet(): Wallet {
    return Wallet.generate();
  }

  importWallet(privateKey: string): Wallet {
    return Wallet.fromPrivateKey(privateKey);
  }

  // ==================== REST API ====================

  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: any } = {}
  ): Promise<T> {
    const url = this.restUrl + endpoint;
    
    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        // @ts-ignore - AbortSignal.timeout is supported in Node 18+
        signal: AbortSignal.timeout(this.timeout)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new DigitalChainError(
          'API_ERROR',
          error.error || `HTTP ${response.status}`,
          { status: response.status }
        );
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new DigitalChainError(ERRORS.NETWORK_ERROR, 'Request timeout', error);
      }
      throw new DigitalChainError(ERRORS.NETWORK_ERROR, error.message, error);
    }
  }

  async getBalance(address: string): Promise<number> {
    const endpoint = API_ENDPOINTS.GET_BALANCE.replace(':address', address);
    const result = await this.request<{ address: string; balance: number }>(endpoint);
    return result.balance;
  }

  async getNonce(address: string): Promise<number> {
    const endpoint = API_ENDPOINTS.GET_NONCE.replace(':address', address);
    const result = await this.request<{ address: string; nonce: number }>(endpoint);
    return result.nonce;
  }

  async getChainInfo(): Promise<ChainInfo> {
    return this.request<ChainInfo>(API_ENDPOINTS.GET_CHAIN);
  }

  async getBlock(index: number): Promise<Block> {
    const endpoint = API_ENDPOINTS.GET_BLOCK.replace(':index', index.toString());
    return this.request<Block>(endpoint);
  }

  async getPendingTransactions(): Promise<PendingTransaction[]> {
    const result = await this.request<{ count: number; transactions: PendingTransaction[] }>(
      API_ENDPOINTS.GET_PENDING
    );
    return result.transactions;
  }

  async health(): Promise<HealthStatus> {
    return this.request<HealthStatus>(API_ENDPOINTS.HEALTH);
  }

  async sendTransaction(txOptions: {
    from: string;
    to: string;
    amount: number;
    gasPrice?: number;
    gasLimit?: number;
    privateKey: string;
  }): Promise<TransactionResult> {
    // 验证地址格式
    if (!/^0x[a-fA-F0-9]{40}$/.test(txOptions.from) || !/^0x[a-fA-F0-9]{40}$/.test(txOptions.to)) {
      throw new DigitalChainError(ERRORS.INVALID_ADDRESS, 'Invalid address format');
    }

    return this.request<TransactionResult>(API_ENDPOINTS.CREATE_TRANSACTION, {
      method: 'POST',
      body: txOptions
    });
  }

  async mineBlock(minerAddress: string): Promise<Block> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(minerAddress)) {
      throw new DigitalChainError(ERRORS.INVALID_ADDRESS, 'Invalid miner address');
    }

    const result = await this.request<MineResult>(API_ENDPOINTS.MINE_BLOCK, {
      method: 'POST',
      body: { minerAddress }
    });
    return result.block;
  }

  // ==================== WebSocket ====================

  connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === 1) {
        return resolve();
      }

      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('[SDK] WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error: any) => {
        console.error('[SDK] WebSocket error:', error);
        reject(new DigitalChainError(ERRORS.NETWORK_ERROR, 'WebSocket connection failed', error));
      };

      this.ws.onclose = () => {
        console.log('[SDK] WebSocket closed');
        this.emit('close', {});
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;
          
          if (this.eventHandlers.has(type)) {
            for (const handler of this.eventHandlers.get(type)!) {
              handler(data);
            }
          }
        } catch (e) {
          console.error('[SDK] Failed to parse WebSocket message:', e);
        }
      };
    });
  }

  disconnectWebSocket(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to an event
   */
  on(event: 'chain_update', handler: (data: ChainInfo) => void): void;
  on(event: 'new_block', handler: (data: Block) => void): void;
  on(event: 'new_transaction', handler: (data: SerializedTransaction) => void): void;
  on(event: 'error', handler: (data: DigitalChainError) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    if (this.eventHandlers.has(event)) {
      for (const handler of this.eventHandlers.get(event)!) {
        handler(data);
      }
    }
  }
}
