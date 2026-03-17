# Show HN: Digital Chain – A blockchain built for AI agents

**Post to**: https://news.ycombinator.com/item?id=...

---

## Title

Show HN: Digital Chain – A high-performance blockchain designed for AI agents (Open Source)

---

## Body

Hi HN,

I've been working on **Digital Chain** — a blockchain optimized for AI agents and autonomous systems.

### The Problem

Current blockchains (Bitcoin, Ethereum) aren't designed for AI:
- **Too slow**: 10 min / 15 sec block times — AI needs < 2 sec
- **Key management**: AI can't securely store private keys like humans
- **Smart contracts**: Writing secure Solidity is hard even for humans, nearly impossible for AI
- **Gas volatility**: Unpredictable costs break automation

### The Solution

Digital Chain is built differently:

✅ **2-second block time** — near real-time for AI decision loops
✅ **Simple API** — REST + WebSocket, no Web3.js complexity
✅ **TypeScript SDK** — type-safe, AI-friendly
✅ **Fixed fees** — 1 OCT per transaction, predictable
✅ **P2P network** — 3-node testnet validated, 1000+ node scalability
✅ **Open source** — MIT license

### Tech Highlights

- **Consensus**: Longest chain with difficulty adjustment (like Bitcoin but faster)
- **P2P**: Custom binary protocol over TCP, mDNS auto-discovery
- **Crypto**: secp256k1 signatures, SHA256/RIPEMD160 hashing
- **SDK**: `@digital-chain/js` — wallet creation, transaction signing, WS client
- **DApps**: Token transfer and voting examples included

### Quick Start

```bash
git clone https://github.com/skycn1983/digital-chain.git
cd digital-chain && npm install

# Start 3-node testnet
./testnet-launch.sh

# Try the SDK
node sdk/examples/01-create-wallet.ts
```

### Performance Targets

We're still optimizing, but goals:
- **TPS**: >100
- **Latency**: p99 < 500ms
- **Block time**: ~2 seconds

Benchmark results will be posted soon.

### Why AI Needs This

As AI agents become autonomous, they need their own economy:
- Pay for APIs/services without human intervention
- Micro-transactions between bots
- Decentralized AI marketplaces
- AI DAO governance
- Reputation systems

Digital Chain aims to be the **default payment layer for AI**.

### Current Status

- ✅ v1.1.0 released
- ✅ 3-node testnet running
- ✅ SDK published to npm (`@digital-chain/js`)
- ✅ Security audit completed (see docs/security-audit.md)
- ⚠️ Mainnet pending community growth

### Get Involved

- **GitHub**: https://github.com/skycn1983/digital-chain
- **Docs**: https://github.com/skycn1983/digital-chain#readme
- **Issues**: Bug reports, feature requests welcome
- **Contributors**: Looking for P2P experts, security auditors, DevOps

### What's Next

1. Performance benchmarks (this week)
2. Third-party security audit
3. Community growth (Discord, Twitter)
4. Integrations with LangChain, AutoGPT, etc.
5. Mainnet launch (community-driven)

---

**Star the repo if you believe in an AI-native blockchain**: ⭐ https://github.com/skycn1983/digital-chain

I'll be in the comments answering questions. Thanks for checking this out!

---

**Note**: This is a weekend project turned serious. The code is production-capable but still young. We're looking for early adopters and contributors to help build the AI economy.