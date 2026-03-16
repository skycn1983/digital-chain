/**
 * Constants for Digital Chain SDK
 */

export const DEFAULT_REST_URL = 'http://localhost:3000';
export const DEFAULT_WS_URL = 'ws://localhost:3000';
export const DEFAULT_P2P_PORT = 30001;

export const API_ENDPOINTS = {
  CREATE_WALLET: '/wallet/create',
  GET_BALANCE: '/balance/:address',
  GET_NONCE: '/nonce/:address',
  CREATE_TRANSACTION: '/transaction',
  MINE_BLOCK: '/mine',
  GET_CHAIN: '/chain',
  GET_BLOCK: '/block/:index',
  GET_PENDING: '/pending',
  HEALTH: '/health'
};

export const WS_EVENTS = {
  CHAIN_UPDATE: 'chain_update',
  NEW_BLOCK: 'new_block',
  NEW_TRANSACTION: 'new_transaction'
} as const;

export const DEFAULT_TIMEOUT = 10000; // 10 seconds

export const MIN_GAS_PRICE = 1;
export const MIN_GAS_LIMIT = 21000;
export const MIN_TX_AMOUNT = 1;
