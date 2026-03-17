#!/bin/bash
set -e

echo "=== Digital Chain 快速功能验证 ==="
echo ""

# 1. 创建钱包
echo "1. 创建钱包..."
W1=$(curl -s -X POST http://localhost:3000/wallet/create)
ADDR1=$(echo $W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")
PRIV1=$(echo $W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['privateKey'])")
echo "   Wallet1地址: $ADDR1"
echo ""

# 2. 挖矿获得资金
echo "2. 挖矿3块..."
for i in 1 2 3; do
  curl -s -X POST http://localhost:3000/mine -H "Content-Type: application/json" -d "{\"minerAddress\":\"$ADDR1\"}" >/dev/null
  echo "   Block $i mined"
done
echo ""

# 3. 查询余额
echo "3. 查询余额..."
curl -s http://localhost:3000/balance/$ADDR1 | python3 -m json.tool
echo ""

# 4. 创建第二个钱包
echo "4. 创建接收方钱包..."
W2=$(curl -s -X POST http://localhost:3000/wallet/create)
ADDR2=$(echo $W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['address'])")
echo "   Wallet2地址: $ADDR2"
echo ""

# 5. 发送交易
echo "5. 发送10 OCT到Wallet2..."
TX_RESP=$(curl -s -X POST http://localhost:3000/transaction -H "Content-Type: application/json" -d "{
  \"from\": \"$ADDR1\",
  \"to\": \"$ADDR2\",
  \"amount\": 10,
  \"gasPrice\": 1,
  \"gasLimit\": 21000,
  \"privateKey\": \"$PRIV1\"
}")
echo $TX_RESP | python3 -m json.tool
echo ""

# 6. 检查 pending
echo "6. 检查pending交易池..."
curl -s http://localhost:3000/pending | python3 -m json.tool
echo ""

# 7. 挖矿确认
echo "7. 挖矿确认交易..."
curl -s -X POST http://localhost:3000/mine -H "Content-Type: application/json" -d "{\"minerAddress\":\"$ADDR1\"}" >/dev/null
echo "   Block mined"
echo ""

# 8. 最终余额
echo "8. 最终余额..."
echo "   Wallet1余额:"
curl -s http://localhost:3000/balance/$ADDR1 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])"
echo "   Wallet2余额:"
curl -s http://localhost:3000/balance/$ADDR2 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])"
echo ""

echo "=== 验证完成 ==="
