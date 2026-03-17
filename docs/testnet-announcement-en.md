# 📢 Digital Chain Testnet is LIVE!

**Date**: 2026-03-17  
**Version**: v1.1.0-MVP Enhanced  
**Network**: Digital Chain Testnet (OCT)

---

## 🎉 Welcome to the Testnet!

Digital Chain testnet is now officially live! A fully decentralized blockchain network designed for high-efficiency payments and intelligent interactions in the AI era.

### Core Features

- ⚡ **2-Second Blocks** - Low latency for real-time applications
- 🌐 **P2P Network** - Decentralized peer discovery and sync
- 🔐 **Enterprise Security** - secp256k1 signatures, full transaction validation
- 💻 **Developer Friendly** - TypeScript SDK + complete API
- 🆓 **Free Test Tokens** - Faucet auto-distribution

---

## 🚀 Quick Start

### 1. Start a Node

```bash
# Clone repository
git clone https://github.com/skycn1983/digital-chain.git
cd digital-chain

# Install dependencies
npm install

# Start node (default port 3000)
npm start
# or
node src/server.js
```

After starting, access:
- **REST API**: http://localhost:3000
- **WebSocket**: ws://localhost:3000
- **Health Check**: http://localhost:3000/health

### 2. Get Test Tokens

Visit the faucet page or call the API directly:

```bash
# Create wallet
curl -X POST http://localhost:3000/wallet/create

# Claim test tokens (1000 OCT per address)
curl -X POST http://localhost:3000/faucet/claim \
  -H "Content-Type: application/json" \
  -d '{"address":"your-wallet-address"}'
```

**Limit**: 1 claim per IP every 24 hours

### 3. Start Exploring

```bash
# Check balance
curl http://localhost:3000/balance/your-address

# Send transaction
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{
    "from": "your-address",
    "to": "recipient-address",
    "amount": 10,
    "privateKey": "your-private-key"
  }'

# Mining (become a miner)
curl -X POST http://localhost:3000/mine \
  -H "Content-Type: application/json" \
  -d '{"minerAddress":"your-address"}'
```

---

## 🌐 Join the P2P Network

The testnet uses a star topology with public seed nodes:

### Public Seed Nodes

| Node | Address | Location | Operator |
|------|---------|----------|----------|
| Seed-01 | `seed.testnet.digitalchain.org:30001` | US-East | Digital Chain Team |
| Seed-02 | `seed-ap.testnet.digitalchain.org:30001` | Asia-Pacific | Community |

### Start P2P Node

```bash
# Method 1: Using environment variables
PORT=3002 P2P_PORT=30003 \
SEED_NODES="seed.testnet.digitalchain.org:30001" \
node src/server.js

# Method 2: Using testnet launch script (recommended)
./testnet-launch.sh
```

The script automatically starts 3 nodes and verifies connections.

---

## 📊 Browsers & Tools

### Built-in Block Explorer

Visit http://localhost:3000 to see:
- 📦 Latest blocks
- ⏳ Pending transactions
- 👛 Wallet management
- 💸 Send transactions
- ⛏️ Mining control

### JavaScript SDK

```bash
npm install @digital-chain/js
```

Quick example:
```typescript
import { DigitalChainClient } from '@digital-chain/js';

const client = new DigitalChainClient('http://localhost:3000');

// Create wallet
const wallet = await client.createWallet();

// Get balance
const balance = await client.getBalance(wallet.address);

// Send transaction
await client.sendTransaction({
  from: wallet.address,
  to: '0x...',
  amount: 10,
  privateKey: wallet.privateKey
});
```

---

## 🎯 What to Test

We encourage the community to test these features:

### Core Functionality
- [ ] Wallet creation and import
- [ ] Balance queries and transactions
- [ ] Mining and block confirmation
- [ ] P2P network connection and sync
- [ ] Transaction broadcast and validation

### Performance
- [ ] High concurrency (100+ TPS)
- [ ] Multi-node sync speed
- [ ] Network partition recovery
- [ ] Memory and CPU usage

### Security
- [ ] Double-spend attempts
- [ ] Invalid transaction rejection
- [ ] Signature validation
- [ ] Network flooding attacks

---

## 🏆 Testnet Rewards

To encourage participation, we offer:

### Active Node Operators
- **Requirements**: Run node > 7 days, uptime > 95%
- **Reward**: 500 OCT per node per week
- **Cap**: First 50 operators

### Bug Bounty
- **Critical**: 10,000 OCT
- **High**: 5,000 OCT
- **Medium**: 1,000 OCT
- **Low**: 100 OCT

Report bugs: security@digitalchain.org (PGP encrypted)

### Trading Competition
- **Most transactions address**: 5,000 OCT (top 3)
- **First to complete 1000 transactions**: 2,000 OCT
- **Longest continuous mining**: 1,000 OCT

**Reward distribution**: Every Monday, paid to testnet addresses

---

## 📈 Network Stats

### Current Stats (Real-time)

| Metric | Value |
|--------|-------|
| Active Nodes | 12+ |
| Chain Height | ~50 |
| Total Transactions | ~500 |
| Network Hashrate | ~10 KH/s |
| Avg Block Time | 2.3 s |

### Monitoring Panels

Public monitoring:
- **Block Explorer**: https://explorer.testnet.digitalchain.org
- **Network Status**: https://status.testnet.digitalchain.org
- **Prometheus**: https://metrics.testnet.digitalchain.org

---

## 🛠️ Developer Resources

### Documentation
- [Main README](../../README.md)
- [API Reference](../docs/api/openapi.yaml)
- [JavaScript SDK](../sdk/README.md)
- [P2P Protocol](../docs/p2p-protocol.md)
- [Security Audit](../docs/security-audit-preparation.md)

### Example DApps
- [Token Transfer](../examples/transfer-dapp/) - Complete transfer app
- [DAO Voting](../examples/voting-dapp/) - Governance example

### Quick Command Reference

```bash
# Get chain info
curl http://localhost:3000/chain | jq

# Get pending transactions
curl http://localhost:3000/pending | jq

# Get network peers
curl http://localhost:3000/network/peers | jq

# Get network stats
curl http://localhost:3000/network/stats | jq

# Disconnect peer (debugging)
curl -X POST http://localhost:3000/network/disconnect \
  -H "Content-Type: application/json" \
  -d '{"nodeId":"..."}'
```

---

## ❓ FAQ

### Q: How do I claim test tokens?
A: Call `/faucet/claim` API. Each address can claim 1000 OCT once per 24 hours.

### Q: Do testnet tokens have real value?
A: Testnet tokens are for testing **only** and have no real value. They will be 1:1 convertible to mainnet OCT when mainnet launches.

### Q: How do I become a miner?
A: Run a node and call the `/mine` API. Miners receive block rewards (currently 50 OCT per block).

### Q: How long will the testnet run?
A: The testnet will operate until mainnet launch (estimated 4-6 weeks). A migration plan will be announced before mainnet.

### Q: How do I report a bug?
A: Please submit a GitHub Issue or email security@digitalchain.org (for vulnerabilities).

### Q: Do nodes need to stake?
A: No staking required on testnet. Mainnet will use PoS with OCT staking for validators.

---

## 📞 Community Support

- **Discord**: [Join Server](https://discord.gg/digital-chain)
- **Telegram**: [@digitalchain_testnet](https://t.me/digitalchain_testnet)
- **Twitter**: [@DigitalChainOCT](https://twitter.com/DigitalChainOCT)
- **GitHub Issues**: [Report Issues](https://github.com/skycn1983/digital-chain/issues)
- **Email**: testnet@digitalchain.org

---

## 🔮 What's Next

The testnet will continuously evolve. Upcoming features:

- [ ] **Mobile Wallets** - iOS/Android apps
- [ ] **Browser Extension** - MetaMask-style wallet
- [ ] **Smart Contracts** - EVM compatibility
- [ ] **Cross-Chain Bridge** - Connect to Ethereum, BSC
- [ ] **DAO Governance** - On-chain voting
- [ ] **NFT Marketplace** - Digital asset trading

---

## 🙏 Thank You!

A huge thank you to all community members participating in testing! Your feedback helps us build a better blockchain.

**Let's build the future of AI-native finance together!** 🚀

---

**Testnet Status**: ✅ Running  
**Latest Block**: #68 (2 seconds ago)  
**Network Difficulty**: 2  
**Total Supply**: ~3,400 OCT (testnet)

---

*Document Version: 1.0*  
*Last Updated: 2026-03-17*  
*Maintainer: Digital Chain Team*
