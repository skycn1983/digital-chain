#!/bin/bash
set -e

echo "=== P2P 广播验证 ==="
echo ""

# 清理并重新开始
cd digital-chain
pkill -f "node src/server.js" >/dev/null 2>&1 || true
rm -rf data/testnet-node*
./testnet-launch.sh > /tmp/verify-p2p.log 2>&1 &
sleep 15

# 创建钱包1
W1=$(curl -s -X POST http://localhost:3000/wallet/create)
A1=$(echo $W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")
echo "Wallet1: $A1"

# 挖矿 2 块
for i in 1 2; do curl -s -X POST http://localhost:3000/mine -H "Content-Type: application/json" -d "{\"minerAddress\":\"$A1\"}" >/dev/null; done

# 创建钱包2
W2=$(curl -s -X POST http://localhost:3000/wallet/create)
A2=$(echo $W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")
echo "Wallet2: $A2"

P1=$(echo $W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['privateKey'])")

# 发送交易
echo "Sending transaction..."
TX=$(curl -s -X POST http://localhost:3000/transaction -H "Content-Type: application/json" -d "{\"from\":\"$A1\",\"to\":\"$A2\",\"amount\":5,\"gasPrice\":1,\"gasLimit\":21000,\"privateKey\":\"$P1\"}")
echo $TX | python3 -m json.tool

# 立即检查所有节点的 pending（在挖矿前）
echo ""
echo "检查交易广播（立即）:"
echo "Node1 pending: $(curl -s http://localhost:3000/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"
echo "Node2 pending: $(curl -s http://localhost:3002/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"
echo "Node3 pending: $(curl -s http://localhost:3004/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"

# 等待 2 秒让广播传播
sleep 2
echo ""
echo "检查交易广播（2秒后）:"
echo "Node1 pending: $(curl -s http://localhost:3000/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"
echo "Node2 pending: $(curl -s http://localhost:3002/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"
echo "Node3 pending: $(curl -s http://localhost:3004/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])")"

# 检查节点2是否收到交易（通过 pending 或链上）
if [ $(curl -s http://localhost:3002/pending | python3 -c "import sys, json; print(json.load(sys.stdin)['count'])") -gt 0 ]; then
  echo ""
  echo "✅ P2P 广播成功：节点2收到交易"
else
  echo ""
  echo "❌ P2P 广播失败：节点2 pending 为空"
fi

# 清理
pkill -f "node src/server.js" >/dev/null 2>&1 || true
