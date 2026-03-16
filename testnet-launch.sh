#!/bin/bash

# Digital Chain 测试网启动脚本
# 启动 3 个节点并验证 P2P 网络连接

set -e

echo "🚀 Starting Digital Chain testnet with 3 nodes..."
echo ""

# 清理旧的测试数据
echo "🧹 Cleaning up old test data..."
rm -rf data/testnet-node{1,2,3}
mkdir -p data/testnet-node{1,2,3}

# 启动节点 1 (种子节点，REST 3000, P2P 30001)
echo "📡 Starting Node 1 (seed, REST=3000, P2P=30001)..."
PORT=3000 P2P_PORT=30001 NODE_ID_SEED=node1 DATA_DIR=data/testnet-node1 node src/server.js > logs/node1.log 2>&1 &
NODE1_PID=$!
sleep 2

# 启动节点 2 (REST 3002, P2P 30003, 连接 node1)
echo "📡 Starting Node 2 (REST=3002, P2P=30003) with seed Node1..."
PORT=3002 P2P_PORT=30003 NODE_ID_SEED=node2 DATA_DIR=data/testnet-node2 SEED_NODES="127.0.0.1:30001" node src/server.js > logs/node2.log 2>&1 &
NODE2_PID=$!
sleep 2

# 启动节点 3 (REST 3004, P2P 30005, 连接 node1)
echo "📡 Starting Node 3 (REST=3004, P2P=30005) with seed Node1..."
PORT=3004 P2P_PORT=30005 NODE_ID_SEED=node3 DATA_DIR=data/testnet-node3 SEED_NODES="127.0.0.1:30001" node src/server.js > logs/node3.log 2>&1 &
NODE3_PID=$!
sleep 3

echo ""
echo "✅ All nodes started (PIDs: $NODE1_PID, $NODE2_PID, $NODE3_PID)"
echo ""

# 等待节点完全启动
echo "⏳ Waiting for nodes to fully start..."
sleep 3

# 验证节点 1
echo "🔍 Verifying Node 1 (http://localhost:3000)..."
curl -s http://localhost:3000/health | head -c 200 || echo "❌ Node1 health check failed"
echo ""

# 验证节点 2
echo "🔍 Verifying Node 2 (http://localhost:3002)..."
curl -s http://localhost:3002/health | head -c 200 || echo "❌ Node2 health check failed"
echo ""

# 验证节点 3
echo "🔍 Verifying Node 3 (http://localhost:3004)..."
curl -s http://localhost:3004/health | head -c 200 || echo "❌ Node3 health check failed"
echo ""

# 检查 P2P 连接状态
echo "🌐 Checking P2P peer connections (from Node1)..."
curl -s http://localhost:3000/network/peers | head -c 500 || echo "❌ Could not fetch peers"
echo ""

# 显示网络统计
echo "📊 Network stats (Node1):"
curl -s http://localhost:3000/network/stats | head -c 500
echo ""
echo ""

# 测试交易广播
echo "💸 Testing transaction broadcast across network..."
echo "  Creating wallet on Node1..."
WALLET1=$(curl -s -X POST http://localhost:3000/wallet/create | head -c 200)
echo "  Wallet1: $WALLET1"
echo "  Creating wallet on Node2..."
WALLET2=$(curl -s -X POST http://localhost:3002/wallet/create | head -c 200)
echo "  Wallet2: $WALLET2"
echo "  Mining a block on Node1 to get funds..."
curl -s -X POST http://localhost:3000/mine -H "Content-Type: application/json" -d '{"minerAddress":"0x1234"}' | head -c 200
sleep 1
echo "  Sending transaction from Node1 to Node2..."
curl -s -X POST http://localhost:3000/transaction -H "Content-Type: application/json" -d '{"from":"0x1234","to":"0x5678","amount":10}' | head -c 200
sleep 2
echo "  Checking if transaction reached Node2's pending pool..."
curl -s http://localhost:3002/network/stats | head -c 500
echo ""

echo "🎉 Testnet launched successfully!"
echo ""
echo "📋 Node information:"
echo "  Node 1: REST http://localhost:3000  | P2P 127.0.0.1:30001"
echo "  Node 2: REST http://localhost:3002  | P2P 127.0.0.1:30003"
echo "  Node 3: REST http://localhost:3004  | P2P 127.0.0.1:30005"
echo ""
echo "🔧 To stop all nodes:"
echo "  kill $NODE1_PID $NODE2_PID $NODE3_PID"
echo ""
echo "📝 Logs are in logs/node*.log"
echo ""
echo "✨ Next steps:"
echo "  1. Test fork scenario: manually create competing chains"
echo "  2. Performance benchmark: measure throughput and latency"
echo "  3. Deploy to public seeds for wider testing"
