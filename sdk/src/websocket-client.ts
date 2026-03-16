import { WebSocket } from 'ws';

export type WebSocketEventType = 
  | 'chain_update' 
  | 'new_block' 
  | 'new_transaction';

export interface ChainUpdateEvent {
  type: 'chain_update';
  data: {
    stats: {
      blocks: number;
      pending: number;
      difficulty: number;
      reward: number;
      latestHash: string;
      valid: boolean;
    };
    latestBlock: any;
  };
}

export interface NewBlockEvent {
  type: 'new_block';
  data: {
    index: number;
    hash: string;
    transactions: Array<{ hash: string; from: string; to: string; amount: number }>;
    timestamp: number;
    miner: string;
    reward: number;
  };
}

export interface NewTransactionEvent {
  type: 'new_transaction';
  data: {
    hash: string;
    from: string;
    to: string;
    amount: number;
    nonce: number;
    timestamp: number;
  };
}

export type WebSocketMessage = ChainUpdateEvent | NewBlockEvent | NewTransactionEvent;

export interface WebSocketClientOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

/**
 * WebSocket client for Digital Chain real-time events
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private autoReconnect: boolean;
  private reconnectInterval: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<WebSocketEventType, Set<Function>> = new Map();
  private isConnected: boolean = false;

  constructor(url: string, options: WebSocketClientOptions = {}) {
    this.url = url;
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectInterval = options.reconnectInterval ?? 5000;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('🔗 WebSocket connected');
          this.isConnected = true;
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }
          resolve();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString()) as WebSocketMessage;
            this.emit(msg.type, msg.data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        });

        this.ws.on('close', () => {
          console.log('🔗 WebSocket disconnected');
          this.isConnected = false;
          if (this.autoReconnect) {
            this.reconnectTimer = setTimeout(() => {
              console.log('🔄 Reconnecting...');
              this.connect().catch(console.error);
            }, this.reconnectInterval);
          }
        });

        this.ws.on('error', (err) => {
          console.error('WebSocket error:', err);
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Subscribe to specific event type
   */
  on(event: WebSocketEventType, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from event
   */
  off<T extends WebSocketEventType>(event: T, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(type: WebSocketEventType, data: any) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          (cb as Function)(data);
        } catch (e: any) {
          console.error(`Error in ${type} listener:`, e);
        }
      });
    }
  }

  /**
   * Subscribe to all events (convenience method)
   */
  onAll(callback: (type: WebSocketEventType, data: any) => void): void {
    ['chain_update', 'new_block', 'new_transaction'].forEach(event => {
      this.on(event as any, (data) => callback(event as any, data));
    });
  }
}
