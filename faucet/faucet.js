#!/usr/bin/env node

/**
 * Digital Chain 测试网水龙头
 * 向指定地址发送测试代币
 */

const http = require('http');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 8081;
const NODE_URL = process.env.NODE_URL || 'http://localhost:3000';
const FAUCET_AMOUNT = parseInt(process.env.FAUCET_AMOUNT) || 1000; // 每次发放 1000 OCT
const FAUCET_KEY = process.env.FAUCET_KEY || 'testnet-faucet-key-2026'; // 水龙头私钥（生产环境需更安全）

// 简单内存限流（生产环境用 Redis）
const claimHistory = new Map(); // IP -> timestamp

function claimAllowed(ip) {
  const now = Date.now();
  const lastClaim = claimHistory.get(ip);
  if (!lastClaim) {
    claimHistory.set(ip, now);
    return true;
  }
  const hoursSince = (now - lastClaim) / (1000 * 60 * 60);
  if (hoursSince >= 24) {
    claimHistory.set(ip, now);
    return true;
  }
  return false;
}

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, NODE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendFaucet(toAddress, ip) {
  try {
    // 检查是否已领取
    if (!claimAllowed(ip)) {
      return {
        success: false,
        error: 'Rate limit: one claim per 24 hours per IP'
      };
    }

    // 获取水龙头钱包余额
    const balanceRes = await request('GET', `/balance/${FAUCET_ADDRESS}`);
    const balance = balanceRes.data.balance;

    if (balance < FAUCET_AMOUNT) {
      return {
        success: false,
        error: `Faucet balance too low (${balance} OCT). Please contact admin.`
      };
    }

    // 发送交易
    const txRes = await request('POST', '/transaction', {
      from: FAUCET_ADDRESS,
      to: toAddress,
      amount: FAUCET_AMOUNT,
      gasPrice: 1,
      gasLimit: 21000,
      privateKey: FAUCET_KEY
    });

    if (txRes.status === 200 && txRes.data.success) {
      return {
        success: true,
        txHash: txRes.data.hash,
        amount: FAUCET_AMOUNT,
        message: `Sent ${FAUCET_AMOUNT} OCT to ${toAddress}`
      };
    } else {
      return {
        success: false,
        error: txRes.data?.error || 'Transaction failed'
      };
    }
  } catch (e) {
    return {
      success: false,
      error: e.message
    };
  }
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
      claimsToday: claimHistory.size
    }));
    return;
  }

  // 水龙头领取
  if (req.method === 'POST' && req.url === '/claim') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { address } = JSON.parse(body);
        const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!address) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Address required' }));
          return;
        }

        // 简单地址格式验证
        if (!address.startsWith('0x') || address.length !== 42) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid address format' }));
          return;
        }

        const result = await sendFaucet(address, clientIp);
        res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 首页
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Digital Chain Testnet Faucet</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #007AFF; }
    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { background: #007AFF; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background: #0066CC; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .result { margin-top: 20px; padding: 15px; border-radius: 4px; display: none; }
    .result.success { background: #d4edda; color: #155724; }
    .result.error { background: #f8d7da; color: #721c24; }
    .stats { margin-top: 30px; padding: 15px; background: #e9ecef; border-radius: 4px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>💧 Digital Chain Testnet Faucet</h1>
    <p>领取免费测试代币 (OCT) 用于开发测试。</p>
    
    <label>钱包地址:</label>
    <input type="text" id="address" placeholder="0x...">
    <button onclick="claim()" id="btn">领取 1000 OCT</button>
    
    <div class="result" id="result"></div>
    
    <div class="stats">
      <strong>规则:</strong><br>
      • 每地址每 24 小时可领取 1 次<br>
      • 每次发放 1000 OCT<br>
      • 仅用于测试网，无真实价值<br>
      <br>
      <strong>状态:</strong><br>
      • 节点运行: <span style="color:green">✅ 正常</span><br>
      • 余额剩余: <span id="balance">Loading...</span> OCT
    </div>
  </div>

  <script>
    async function claim() {
      const address = document.getElementById('address').value.trim();
      const btn = document.getElementById('btn');
      const result = document.getElementById('result');
      
      if (!address) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = '请输入钱包地址';
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ 处理中...';

      try {
        const res = await fetch('/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address })
        });
        const data = await res.json();
        
        result.style.display = 'block';
        if (data.success) {
          result.className = 'result success';
          result.innerHTML = \`✅ 成功！交易哈希: <a href="/tx/\${data.txHash}" target="_blank">\${data.txHash.substring(0, 16)}...</a>\`;
        } else {
          result.className = 'result error';
          result.textContent = '❌ ' + data.error;
        }
      } catch (e) {
        result.style.display = 'block';
        result.className = 'result error';
        result.textContent = '❌ 网络错误';
      } finally {
        btn.disabled = false;
        btn.textContent = '领取 1000 OCT';
      }
    }

    // 刷新余额
    async function refreshBalance() {
      try {
        const res = await fetch('/faucet-balance');
        const data = await res.json();
        document.getElementById('balance').textContent = data.balance;
      } catch (e) {
        document.getElementById('balance').textContent = 'Error';
      }
    }

    refreshBalance();
    setInterval(refreshBalance, 30000);
  </script>
</body>
</html>
    `);
    return;
  }

  // 获取水龙头余额（仅调试用）
  if (req.method === 'GET' && req.url === '/faucet-balance') {
    try {
      const balanceRes = await request('GET', `/balance/${FAUCET_ADDRESS}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ balance: balanceRes.data.balance }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// 启动水龙头钱包地址（从环境变量读取，或使用默认测试钱包）
const FAUCET_ADDRESS = process.env.FAUCET_ADDRESS || '0xTestFaucetWalletAddress0000000000000';

server.listen(PORT, () => {
  console.log(`
💧 Digital Chain Testnet Faucet Started
======================================
🌐 Faucet URL: http://localhost:${PORT}
🔗 Node URL: ${NODE_URL}
💰 Faucet Address: ${FAUCET_ADDRESS}
💰 Amount per claim: ${FAUCET_AMOUNT} OCT
⏰ Rate limit: 1 claim per 24 hours per IP

📝 To fund the faucet wallet, send OCT to: ${FAUCET_ADDRESS}
  `);
});
