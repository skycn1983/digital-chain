# @digital-chain/js - Digital Chain JavaScript/TypeScript SDK

[![NPM Version](https://img.shields.io/npm/v/@digital-chain/js)](https://www.npmjs.com/package/@digital-chain/js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official JavaScript/TypeScript SDK for [Digital Chain](https://github.com/openclaw/digital-chain) blockchain.

## Features

- ✅ **TypeScript Support** - Full type definitions included
- ✅ **REST API Client** - Query balances, send transactions, mine blocks
- ✅ **WebSocket Client** - Real-time event subscriptions
- ✅ **Wallet Management** - Create, import, sign transactions
- ✅ **Transaction Builder** - Easy transaction construction and signing
- ✅ **Cross-Platform** - Works in Node.js and browsers
- ✅ **Lightweight** - Minimal dependencies

## Installation

```bash
npm install @digital-chain/js
```

## Quick Start

```typescript
import { DigitalChainClient, Wallet } from '@digital-chain/js';

// Create client
const client = new DigitalChainClient({
  restUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000'
});

// Create wallet
const wallet = Wallet.generate();
console.log('Address:', wallet.address);

// Query balance
const balance = await client.getBalance(wallet.address);
console.log('Balance:', balance, 'OCT');

// Send transaction
const result = await client.sendTransaction({
  from: wallet.address,
  to: '0x...',
  amount: 100,
  privateKey: wallet.exportPrivateKey()
});
console.log('Transaction hash:', result.hash);
```

## API Reference

### DigitalChainClient

Main client class for interacting with Digital Chain nodes.

#### Constructor

```typescript
const client = new DigitalChainClient({
  restUrl?: string;      // REST API URL (default: http://localhost:3000)
  wsUrl?: string;        // WebSocket URL (default: ws://localhost:3000)
  timeout?: number;      // Request timeout in ms (default: 10000)
  logLevel?: string;     // 'debug' | 'info' | 'warn' | 'error'
});
```

#### Methods

##### Wallet Operations

```typescript
// Create new random wallet
const wallet = client.createWallet();

// Import from private key
const wallet = client.importWallet('0x...');
```

##### Blockchain Queries (REST)

```typescript
await client.getBalance(address: string): Promise<number>;
await client.getNonce(address: string): Promise<number>;
await client.getChainInfo(): Promise<ChainInfo>;
await client.getBlock(index: number): Promise<Block>;
await client.getPendingTransactions(): Promise<PendingTransaction[]>;
await client.health(): Promise<HealthStatus>;
```

##### Transactions

```typescript
await client.sendTransaction(options: {
  from: string;
  to: string;
  amount: number;
  gasPrice?: number;    // default: 1
  gasLimit?: number;    // default: 21000
  privateKey: string;   // required for signing
}): Promise<TransactionResult>;
```

##### Mining

```typescript
await client.mineBlock(minerAddress: string): Promise<Block>;
```

##### WebSocket

```typescript
// Connect
await client.connectWebSocket();

// Subscribe to events
client.on('chain_update', (info: ChainInfo) => {});
client.on('new_block', (block: Block) => {});
client.on('new_transaction', (tx: SerializedTransaction) => {});

// Unsubscribe
client.off('new_block', handler);

// Disconnect
client.disconnectWebSocket();
```

### Wallet

Wallet key management and signing.

```typescript
// Create wallet
const wallet = Wallet.generate();

// Import
const wallet = Wallet.fromPrivateKey('0x...');

// Properties
wallet.address;       // string - address (0x...)
wallet.publicKey;    // string - uncompressed public key
wallet.canSign();    // boolean - has private key?

// Methods
wallet.sign(message: string): string;           // ECDSA signature
wallet.exportPrivateKey(): string;              // ⚠️ caution!
wallet.toJSON(): { address: string; publicKey: string };

// Static
Wallet.isValidAddress(address: string): boolean;
```

### Transaction

Transaction builder and serializer.

```typescript
// Create transaction
const tx = new Transaction({
  from: '0x...',
  to: '0x...',
  amount: 100,
  gasPrice: 1,
  gasLimit: 21000
});

// Set nonce (optional, auto-increment if not set)
tx.nonce = await client.getNonce(tx.from);

// Sign with private key
tx.sign(privateKey);

// Serialize for sending
const serialized = tx.serialize();

// Hash
const hash = tx.getHash();

// Fee
const fee = tx.getFee();

// Deserialize
const restoredTx = Transaction.deserialize(serialized);
```

### Types

Full TypeScript definitions included:

- `ClientConfig`, `ChainInfo`, `Block`
- `TransactionOptions`, `TransactionResult`
- `WalletInfo`, `SignedTransaction`
- `ClientEvent` types for WebSocket
- `DigitalChainError` with error codes

## Examples

### 1. Create Wallet and Check Balance

```typescript
const client = new DigitalChainClient();
const wallet = client.createWallet();
console.log('Address:', wallet.address);

const balance = await client.getBalance(wallet.address);
console.log('Balance:', balance);
```

### 2. Send Transaction

```typescript
const alice = client.createWallet();
const bob = client.createWallet();

// Fund Alice (testnet only)
await client.mineBlock(alice.address);
await client.mineBlock(alice.address);

// Send
const result = await client.sendTransaction({
  from: alice.address,
  to: bob.address,
  amount: 50,
  privateKey: alice.exportPrivateKey()
});
console.log('Tx hash:', result.hash);
```

### 3. WebSocket Real-time Updates

```typescript
const client = new DigitalChainClient();
await client.connectWebSocket();

client.on('new_block', (block) => {
  console.log(`New block #${block.index}!`);
});

client.on('new_transaction', (tx) => {
  console.log(`Tx: ${tx.from} → ${tx.to}`);
});
```

## Running Examples

```bash
# Install dependencies
npm install

# Build SDK
npm run build

# Run example (requires running node)
npx ts-node examples/01-create-wallet.ts
npx ts-node examples/02-send-transaction.ts
npx ts-node examples/03-mine-block.ts
npx ts-node examples/04-websocket-subscribe.ts
npx ts-node examples/05-query-balance.ts
```

## Development

```bash
# Install deps
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

## Browser Usage

```html
<script type="module">
  import { DigitalChainClient, Wallet } from '@digital-chain/js';

  const client = new DigitalChainClient({
    restUrl: 'https://api.digitalchain.io',
    wsUrl: 'wss://api.digitalchain.io'
  });

  // ... same API
</script>
```

## Error Handling

All errors are `DigitalChainError` with code and details:

```typescript
try {
  await client.getBalance('0xinvalid');
} catch (error) {
  if (error instanceof DigitalChainError) {
    console.log('Code:', error.code);  // 'NETWORK_ERROR', 'INVALID_ADDRESS', etc.
    console.log('Message:', error.message);
    console.log('Details:', error.details);
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `NETWORK_ERROR` | Network/connection failure |
| `INVALID_ADDRESS` | Invalid address format |
| `INSUFFICIENT_BALANCE` | Balance too low |
| `INVALID_SIGNATURE` | Transaction signature invalid |
| `INVALID_NONCE` | Nonce mismatch |
| `TRANSACTION_REJECTED` | Transaction validation failed |
| `MINING_FAILED` | Mining operation failed |

## Compatibility

- **Node.js**: 18+
- **Browsers**: Modern browsers with Fetch API and WebSocket
- **Digital Chain**: Compatible with v1.0+ nodes

## Security

⚠️ **Important**:

1. Never expose private keys in production code
2. Use environment variables or secure vaults for key storage
3. Always validate addresses before sending transactions
4. Test thoroughly on testnet before mainnet
5. Keep SDK updated for security patches

## License

MIT © 2026 Digital Chain

## Related

- [Digital Chain Core](https://github.com/openclaw/digital-chain)
- [Documentation](https://digital-chain.readme.io)
- [Bug Bounty Program](https://github.com/openclaw/digital-chain/security)

---

**Happy Building!** 🚀
