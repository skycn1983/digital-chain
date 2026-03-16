#!/bin/bash
# Digital Chain 完整演示脚本

API="http://localhost:3000"
echo "=================================="
echo "  Digital Chain 完整演示"
echo "=================================="
echo ""

# 步骤1: 创建两个钱包
echo "📦 步骤1: 创建钱包"
W1=$(curl -s -X POST $API/wallet/create | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['address'])")
echo "  钱包1 (A): $W1"

W2=$(curl -s -X POST $API/wallet/create | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['address'])")
echo "  钱包2 (B): $W2"
echo ""

# 步骤2: 查询初始余额
echo "💰 步骤2: 初始余额"
echo "  钱包A余额: $(curl -s $API/balance/$W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])") OCT"
echo "  钱包B余额: $(curl -s $API/balance/$W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])") OCT"
echo ""

# 步骤3: 钱包A挖矿获得奖励
echo "⛏️  步骤3: 钱包A挖矿获得奖励"
curl -s -X POST $API/mine -H "Content-Type: application/json" -d "{\"minerAddress\":\"$W1\"}" > /dev/null
echo "  挖矿完成！"
echo ""

# 步骤4: 查询挖矿后余额
echo "💰 步骤4: 挖矿后余额"
BAL_A=$(curl -s $API/balance/$W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])")
echo "  钱包A余额: $BAL_A OCT (应包含50 OCT区块奖励)"
echo "  钱包B余额: $(curl -s $API/balance/$W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])") OCT"
echo ""

# 步骤5: 钱包A转账给钱包B
echo "💸 步骤5: 钱包A向钱包B转账 10000 OCT"
RESULT=$(curl -s -X POST $API/transaction -H "Content-Type: application/json" -d "{\"from\":\"$W1\",\"to\":\"$W2\",\"amount\":10000}")
echo $RESULT | python3 -m json.tool 2>/dev/null || echo "  $RESULT"
echo ""

# 步骤6: 查询交易后余额
echo "💰 步骤6: 交易后余额"
BAL_A=$(curl -s $API/balance/$W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])")
BAL_B=$(curl -s $API/balance/$W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])")
echo "  钱包A余额: $BAL_A OCT (应减少)"
echo "  钱包B余额: $BAL_B OCT (应增加)"
echo ""

# 步骤7: 挖矿确认交易
echo "⛏️  步骤7: 再次挖矿确认交易"
curl -s -X POST $API/mine -H "Content-Type: application/json" -d "{\"minerAddress\":\"$W2\"}" > /dev/null
echo "  挖矿完成！交易已确认。"
echo ""

# 步骤8: 查看链状态
echo "📊 步骤8: 最终链状态"
curl -s $API/chain | python3 -m json.tool | head -25
echo ""

# 步骤9: 查看最新区块
echo "📦 步骤9: 最新区块详情"
BLOCKS=$(curl -s $API/chain | python3 -c "import sys, json; print(json.load(sys.stdin)['stats']['blocks'])")
curl -s $API/block/$((BLOCKS-1)) | python3 -m json.tool | head -40
echo ""

echo "✅ 演示完成！"
echo ""
echo "🌐 浏览器: http://localhost:3000"
echo "📊 链高度: $BLOCKS"
echo "💰 钱包A最终余额: $(curl -s $API/balance/$W1 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])") OCT"
echo "💰 钱包B最终余额: $(curl -s $API/balance/$W2 | python3 -c "import sys, json; print(json.load(sys.stdin)['balance'])") OCT"