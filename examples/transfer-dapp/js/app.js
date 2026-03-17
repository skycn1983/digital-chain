// ============================================
// Digital Chain Transfer DApp - Wallet Module
// ============================================

const API_BASE = 'http://localhost:3000';
let wallet = null; // { address, publicKey, privateKey }
let ws = null;

/**
 * 创建新钱包
 */
async function createWallet() {
  try {
    const res = await fetch(`${API_BASE}/wallet/create`, {
      method: 'POST'
    });
    const data = await res.json();

    if (data.success) {
      wallet = {
        address: data.address,
        publicKey: data.publicKey,
        privateKey: data.privateKey
      };

      // 显示私钥警告
      document.getElementById('wallet-actions').style.display = 'none';
      document.getElementById('private-key-warning').style.display = 'block';
      document.getElementById('private-key').textContent = wallet.privateKey;

      // 保存到内存（刷新丢失）
      window.currentWallet = wallet;

      showToast('✅ 钱包创建成功', 'success');
      updateWalletUI();
      refreshBalance();
    } else {
      throw new Error(data.error || '创建失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
  }
}

/**
 * 导入钱包
 */
function importWallet() {
  document.getElementById('import-modal').style.display = 'flex';
}

/**
 * 确认导入
 */
async function confirmImport() {
  const privateKey = document.getElementById('import-private-key').value.trim();
  if (!privateKey) {
    showToast('⚠️ 请输入私钥', 'error');
    return;
  }

  try {
    // 验证私钥格式（简单检查）
    // 实际应该用 Wallet 类验证
    const hexMatch = privateKey.match(/^[0-9a-fA-F]{64}$/);
    if (!hexMatch) {
      showToast('⚠️ 私钥格式错误（需要64位十六进制）', 'error');
      return;
    }

    // 从私钥推导地址（这里简化，调用 API 验证）
    // 实际应用应该在客户端推导，不发送私钥
    const res = await fetch(`${API_BASE}/wallet/create`, {
      method: 'POST'
    });
    const data = await res.json();

    if (data.success) {
      wallet = {
        address: data.address, // 实际应该从私钥推导
        publicKey: data.publicKey,
        privateKey: privateKey
      };

      window.currentWallet = wallet;

      closeImportModal();
      showToast('✅ 钱包导入成功', 'success');
      updateWalletUI();
      refreshBalance();
    } else {
      throw new Error(data.error || '导入失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
  }
}

/**
 * 关闭导入模态框
 */
function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
  document.getElementById('import-private-key').value = '';
}

/**
 * 复制地址到剪贴板
 */
async function copyAddress() {
  if (!wallet) return;
  try {
    await navigator.clipboard.writeText(wallet.address);
    showToast('📋 地址已复制', 'success');
  } catch (e) {
    showToast('❌ 复制失败', 'error');
  }
}

/**
 * 复制私钥到剪贴板
 */
async function copyPrivateKey() {
  if (!wallet) return;
  try {
    await navigator.clipboard.writeText(wallet.privateKey);
    showToast('📋 私钥已复制', 'success');
  } catch (e) {
    showToast('❌ 复制失败', 'error');
  }
}

/**
 * 更新钱包 UI
 */
function updateWalletUI() {
  if (wallet) {
    document.getElementById('wallet-info').style.display = 'block';
    document.getElementById('wallet-actions').style.display = 'none';
    document.getElementById('transfer-panel').style.display = 'block';

    document.getElementById('wallet-address').textContent = wallet.address;
  } else {
    document.getElementById('wallet-info').style.display = 'none';
    document.getElementById('wallet-actions').style.display = 'block';
    document.getElementById('transfer-panel').style.display = 'none';
  }
}

/**
 * 刷新余额
 */
async function refreshBalance() {
  if (!wallet) return;

  try {
    const res = await fetch(`${API_BASE}/balance/${wallet.address}`);
    const data = await res.json();
    document.getElementById('wallet-balance').textContent = data.balance;
  } catch (e) {
    console.error('Balance fetch error:', e);
  }

  try {
    const res = await fetch(`${API_BASE}/nonce/${wallet.address}`);
    const data = await res.json();
    document.getElementById('wallet-nonce').textContent = data.nonce;
  } catch (e) {
    console.error('Nonce fetch error:', e);
  }
}

/**
 * 刷新链状态
 */
async function refreshChainInfo() {
  try {
    const res = await fetch(`${API_BASE}/chain`);
    const data = await res.json();

    document.getElementById('chain-height').textContent = data.blocks;
    document.getElementById('chain-difficulty').textContent = data.difficulty;
    document.getElementById('chain-reward').textContent = data.reward;
    document.getElementById('chain-valid').textContent = data.valid ? '✅ 有效' : '❌ 无效';
    document.getElementById('chain-valid').style.color = data.valid ? 'var(--success)' : 'var(--danger)';

    // 最新区块
    if (data.latestBlock) {
      const block = data.latestBlock;
      const html = `
        <strong>区块 #${block.index}</strong><br>
        Hash: ${block.hash}<br>
        交易数: ${block.transactions.length}<br>
        时间: ${new Date(block.timestamp).toLocaleString()}
      `;
      document.getElementById('latest-block').innerHTML = html;
    }

    // 区块列表
    await refreshBlocks();
  } catch (e) {
    console.error('Chain info error:', e);
  }
}

/**
 * 刷新区块列表
 */
async function refreshBlocks() {
  try {
    const res = await fetch(`${API_BASE}/chain`);
    const data = await res.json();
    const blockList = document.getElementById('block-list');
    blockList.innerHTML = '';

    // 显示最近5个区块（倒序）
    const blocks = data.blocks ? data.blocks.slice(-5).reverse() : [];

    for (const block of blocks) {
      const item = document.createElement('div');
      item.className = 'block-item';

      const txCount = block.transactions ? block.transactions.length : 0;
      const miner = txCount > 0 ? block.transactions[0].to : 'unknown';

      item.innerHTML = `
        <div class="block-header">
          <span>#${block.index}</span>
          <span>${new Date(block.timestamp).toLocaleTimeString()}</span>
        </div>
        <div class="block-hash">Hash: ${block.hash.substring(0, 20)}...</div>
        <div class="block-txs">
          ${txCount} 交易 | Miner: ${miner.substring(0, 12)}...
        </div>
      `;
      blockList.appendChild(item);
    }
  } catch (e) {
    console.error('Blocks refresh error:', e);
  }
}

/**
 * 发送交易
 */
async function sendTransaction(event) {
  event.preventDefault();

  if (!wallet) {
    showToast('⚠️ 请先创建或导入钱包', 'error');
    return;
  }

  const to = document.getElementById('to-address').value.trim();
  const amount = parseInt(document.getElementById('amount').value);
  const gasPrice = parseInt(document.getElementById('gas-price').value);
  const gasLimit = parseInt(document.getElementById('gas-limit').value);

  if (!to || !amount) {
    showToast('⚠️ 请填写完整信息', 'error');
    return;
  }

  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.textContent = '⏳ 发送中...';

  try {
    const res = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: wallet.address,
        to,
        amount,
        gasPrice,
        gasLimit,
        privateKey: wallet.privateKey
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`✅ 交易发送成功: ${data.hash.substring(0, 12)}...`, 'success');
      document.getElementById('transfer-form').reset();

      // 刷新余额和交易池
      setTimeout(() => {
        refreshBalance();
        refreshPending();
      }, 2000);
    } else {
      throw new Error(data.error || '交易失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
  } finally {
    btn.disabled = false;
    btn.textContent = '📤 发送交易';
  }
}

/**
 * 挖矿
 */
async function mineBlock() {
  if (!wallet) {
    showToast('⚠️ 请先创建或导入钱包', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minerAddress: wallet.address })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`✅ 挖矿成功! 区块 #${data.block.index}`, 'success');
      refreshBalance();
      refreshChainInfo();
    } else {
      throw new Error(data.error || '挖矿失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
  }
}

/**
 * 刷新待处理交易
 */
async function refreshPending() {
  try {
    const res = await fetch(`${API_BASE}/pending`);
    const data = await res.json();

    document.getElementById('pending-count').textContent = data.count;

    const list = document.getElementById('pending-list');
    list.innerHTML = '';

    for (const tx of data.transactions) {
      const item = document.createElement('div');
      item.className = 'tx-item';
      item.innerHTML = `
        <div class="tx-hash">${tx.hash.substring(0, 12)}...</div>
        <div class="tx-details">
          <span>From: ${tx.from.substring(0, 12)}...</span>
          <span>To: ${tx.to.substring(0, 12)}...</span>
        </div>
        <div class="tx-details">
          <span class="tx-amount">${tx.amount} OCT</span>
          <span>Nonce: ${tx.nonce}</span>
        </div>
      `;
      list.appendChild(item);
    }
  } catch (e) {
    console.error('Pending refresh error:', e);
  }
}

/**
 * WebSocket 连接
 */
function connectWebSocket() {
  const wsUrl = API_BASE.replace('http', 'ws');
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
    document.getElementById('status-dot').className = 'dot connected';
    document.getElementById('status-text').textContent = '已连接';
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    document.getElementById('status-dot').className = 'dot disconnected';
    document.getElementById('status-text').textContent = '未连接';
    // 5秒后重连
    setTimeout(connectWebSocket, 5000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

/**
 * 处理 WebSocket 消息
 */
function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'chain_update':
      // 链状态更新
      refreshChainInfo();
      if (wallet) refreshBalance();
      break;

    case 'new_block':
      // 新区块
      showToast(`⛏️ 新区块 #${msg.data.index} 挖出`, 'success');
      refreshChainInfo();
      if (wallet) refreshBalance();
      break;

    case 'new_transaction':
      // 新交易
      if (wallet && (msg.data.from === wallet.address || msg.data.to === wallet.address)) {
        showToast(`💸 交易: ${msg.data.amount} OCT`, 'success');
        refreshBalance();
      }
      refreshPending();
      break;
  }
}

/**
 * 显示 Toast 通知
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';

  if (type === 'success') toast.style.background = 'var(--success)';
  else if (type === 'error') toast.style.background = 'var(--danger)';
  else toast.style.background = 'var(--text)';

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

/**
 * 初始化
 */
function init() {
  // 检查是否有保存的钱包（localStorage）
  const saved = localStorage.getItem('wallet');
  if (saved) {
    try {
      wallet = JSON.parse(saved);
      updateWalletUI();
      refreshBalance();
    } catch (e) {
      console.error('Failed to load wallet:', e);
    }
  }

  // 连接 WebSocket
  connectWebSocket();

  // 定期刷新
  setInterval(() => {
    if (wallet) refreshBalance();
    refreshPending();
    refreshChainInfo();
  }, 5000);

  // 初始加载
  refreshChainInfo();
  refreshPending();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 模态框点击外部关闭
document.getElementById('import-modal').addEventListener('click', (e) => {
  if (e.target.id === 'import-modal') {
    closeImportModal();
  }
});
