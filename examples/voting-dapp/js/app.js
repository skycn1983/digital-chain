// ============================================
// Digital Chain Voting DApp - App Module
// ============================================

const API_BASE = 'http://localhost:3000';
let wallet = null;
let ws = null;
let proposals = []; // 提案列表
let currentProposal = null; // 当前查看的提案

/**
 * 创建新钱包
 */
async function createWallet() {
  try {
    const res = await fetch(`${API_BASE}/wallet/create`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      wallet = {
        address: data.address,
        publicKey: data.publicKey,
        privateKey: data.privateKey
      };

      window.currentWallet = wallet;
      localStorage.setItem('wallet', JSON.stringify(wallet));

      document.getElementById('wallet-actions').style.display = 'none';
      document.getElementById('private-key-warning').style.display = 'block';
      document.getElementById('private-key').textContent = wallet.privateKey;

      document.getElementById('create-panel').style.display = 'block';
      document.getElementById('vote-panel').style.display = 'none';

      showToast('✅ 钱包创建成功', 'success');
      updateWalletUI();
      refreshVotingPower();
      scanProposals(); // 扫描链上提案
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
async function confirmImport() {
  const privateKey = document.getElementById('import-private-key').value.trim();
  if (!privateKey) {
    showToast('⚠️ 请输入私钥', 'error');
    return;
  }

  try {
    // 简化：使用创建接口返回地址（实际应该从私钥推导）
    const res = await fetch(`${API_BASE}/wallet/create`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      wallet = {
        address: data.address,
        publicKey: data.publicKey,
        privateKey: privateKey
      };

      window.currentWallet = wallet;
      localStorage.setItem('wallet', JSON.stringify(wallet));

      closeImportModal();
      showToast('✅ 钱包导入成功', 'success');
      updateWalletUI();
      refreshVotingPower();
      scanProposals();
    } else {
      throw new Error(data.error || '导入失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  }
}

/**
 * 更新钱包 UI
 */
function updateWalletUI() {
  if (wallet) {
    document.getElementById('wallet-info').style.display = 'block';
    document.getElementById('wallet-actions').style.display = 'none';
    document.getElementById('create-panel').style.display = 'block';
    document.getElementById('wallet-address').textContent = wallet.address;
  } else {
    document.getElementById('wallet-info').style.display = 'none';
    document.getElementById('wallet-actions').style.display = 'block';
    document.getElementById('create-panel').style.display = 'none';
    document.getElementById('vote-panel').style.display = 'none';
  }
}

/**
 * 刷新投票权（余额）
 */
async function refreshVotingPower() {
  if (!wallet) return;
  try {
    const res = await fetch(`${API_BASE}/balance/${wallet.address}`);
    const data = await res.json();
    document.getElementById('voting-power').textContent = data.balance;
  } catch (e) {
    console.error('Balance error:', e);
  }
}

/**
 * 扫描链上提案
 *
 * 提案创建交易格式（metadata 字段）:
 * {
 *   type: 'proposal',
 *   title: '...',
 *   description: '...',
 *   endBlock: <区块高度>
 * }
 *
 * 投票交易格式:
 * {
 *   type: 'vote',
 *   proposalId: '<txHash>',
 *   choice: 'yes' | 'no' | 'abstain'
 * }
 */
async function scanProposals() {
  proposals = [];

  try {
    // 获取完整链数据
    const res = await fetch(`${API_BASE}/chain`);
    const chainData = await res.json();

    // 注意：当前 API 返回的链结构可能需要调整
    // 假设 chainData.blocks 是区块列表
    if (!chainData.blocks) {
      console.warn('Chain API 返回结构不包含 blocks 字段');
      return;
    }

    // 扫描所有区块的交易
    for (const block of chainData.blocks) {
      if (!block.transactions) continue;

      for (const tx of block.transactions) {
        // 检查是否为提案创建交易
        // 方案1: to 地址为特殊提案地址
        // 方案2: 使用 metadata 字段（需要节点支持）
        // 这里使用方案1: to === '0x0000000000000000000000000000000000000001' 表示提案
        if (tx.to === '0x0000000000000000000000000000000000000001' && tx.amount === 0) {
          // 解析提案数据（假设 data 字段包含 JSON）
          try {
            const metadata = JSON.parse(tx.data || '{}');
            if (metadata.type === 'proposal') {
              const proposal = {
                id: tx.hash,
                title: metadata.title,
                description: metadata.description || '',
                creator: tx.from,
                startBlock: block.index,
                endBlock: metadata.endBlock || (block.index + 100),
                votes: { yes: 0, no: 0, abstain: 0 },
                voters: {},
                blockIndex: block.index,
                timestamp: block.timestamp
              };
              proposals.push(proposal);
            }
          } catch (e) {
            // 忽略无法解析的交易
          }
        }

        // 检查是否为投票交易
        // to 地址为投票地址: 0x0000000000000000000000000000000000000002
        if (tx.to === '0x0000000000000000000000000000000000000002' && tx.amount === 0) {
          try {
            const metadata = JSON.parse(tx.data || '{}');
            if (metadata.type === 'vote') {
              const proposalId = metadata.proposalId;
              const choice = metadata.choice;

              // 查找对应提案
              const proposal = proposals.find(p => p.id === proposalId);
              if (proposal && !proposal.voters[tx.from]) {
                proposal.votes[choice]++;
                proposal.voters[tx.from] = choice;
              }
            }
          } catch (e) {
            // 忽略
          }
        }
      }
    }

    // 按创建时间倒序
    proposals.sort((a, b) => b.blockIndex - a.blockIndex);

    renderProposalList();
  } catch (e) {
    console.error('Scan proposals error:', e);
  }
}

/**
 * 渲染提案列表
 */
function renderProposalList() {
  const list = document.getElementById('proposal-list');
  list.innerHTML = '';

  document.getElementById('proposals-count').textContent = `${proposals.length} 个提案`;

  if (proposals.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">暂无提案</p>';
    return;
  }

  const currentHeight = proposals.length > 0 ? proposals[0].blockIndex + 100 : 0; // 简化

  for (const prop of proposals) {
    const card = document.createElement('div');
    card.className = 'proposal-card';

    const totalVotes = prop.votes.yes + prop.votes.no + prop.votes.abstain;
    const yesPercent = totalVotes > 0 ? Math.round(prop.votes.yes / totalVotes * 100) : 0;
    const noPercent = totalVotes > 0 ? Math.round(prop.votes.no / totalVotes * 100) : 0;
    const absPercent = totalVotes > 0 ? Math.round(prop.votes.abstain / totalVotes * 100) : 0;

    // 状态
    const now = Date.now() / 1000;
    const isActive = prop.endBlock > currentHeight; // 简化判断，实际需要当前区块高度
    const statusText = isActive ? '进行中' : '已结束';
    const statusClass = isActive ? 'active' : 'ended';

    card.innerHTML = `
      <div class="header">
        <div class="title">${escapeHtml(prop.title)}</div>
        <span class="status ${statusClass}">${statusText}</span>
      </div>
      <div class="desc">${escapeHtml(prop.description)}</div>
      <div class="meta">
        <span>📅 区块: ${prop.startBlock} → ${prop.endBlock}</span>
        <span>🗳️ ${totalVotes} 票</span>
      </div>
      <div class="vote-stats">
        <div class="stat-item">
          <span style="color:var(--success)">✅ ${prop.votes.yes}</span>
          <span style="color:var(--text-secondary)">(${yesPercent}%)</span>
        </div>
        <div class="stat-item">
          <span style="color:var(--danger)">❌ ${prop.votes.no}</span>
          <span style="color:var(--text-secondary)">(${noPercent}%)</span>
        </div>
        <div class="stat-item">
          <span style="color:var(--warning)">⚪ ${prop.votes.abstain}</span>
          <span style="color:var(--text-secondary)">(${absPercent}%)</span>
        </div>
      </div>
    `;

    card.onclick = () => openVotePanel(prop);
    list.appendChild(card);
  }
}

/**
 * 打开投票面板
 */
function openVotePanel(proposal) {
  currentProposal = proposal;

  document.getElementById('proposal-detail').innerHTML = `
    <h3>${escapeHtml(proposal.title)}</h3>
    <div class="full-desc">${escapeHtml(proposal.description)}</div>
    <div class="progress">
      <div class="progress-item">
        <span class="progress-label">支持</span>
        <div class="progress-bar">
          <div class="progress-fill yes" style="width: ${proposal.votes.yes}px"></div>
        </div>
        <span class="progress-value">${proposal.votes.yes}</span>
      </div>
      <div class="progress-item">
        <span class="progress-label">反对</span>
        <div class="progress-bar">
          <div class="progress-fill no" style="width: ${proposal.votes.no}px"></div>
        </div>
        <span class="progress-value">${proposal.votes.no}</span>
      </div>
      <div class="progress-item">
        <span class="progress-label">弃权</span>
        <div class="progress-bar">
          <div class="progress-fill abstain" style="width: ${proposal.votes.abstain}px"></div>
        </div>
        <span class="progress-value">${proposal.votes.abstain}</span>
      </div>
    </div>
    <p style="font-size:0.9rem;color:var(--text-secondary);">
      投票截至: 区块 #${proposal.endBlock} | 已投票: ${Object.keys(proposal.voters).length}
    </p>
  `;

  document.getElementById('proposal-id').value = proposal.id;
  document.getElementById('vote-panel').style.display = 'block';

  // 检查是否已投票
  if (wallet && proposal.voters[wallet.address]) {
    const votedChoice = proposal.voters[wallet.address];
    document.querySelector('input[name="vote"][value="' + votedChoice + '"]').disabled = true;
    showToast(`⚠️ 您已投过票: ${votedChoice}`, 'info');
  }

  // 滚动到投票面板
  document.getElementById('vote-panel').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 关闭投票面板
 */
function closeVotePanel() {
  document.getElementById('vote-panel').style.display = 'none';
  currentProposal = null;
}

/**
 * 提交投票
 */
async function submitVote(event) {
  event.preventDefault();

  if (!wallet) {
    showToast('⚠️ 请先创建或导入钱包', 'error');
    return;
  }

  if (!currentProposal) {
    showToast('⚠️ 请先选择提案', 'error');
    return;
  }

  const choice = document.querySelector('input[name="vote"]:checked').value;
  const proposalId = document.getElementById('proposal-id').value;

  // 检查是否已投票
  if (currentProposal.voters[wallet.address]) {
    showToast('⚠️ 您已经投过票了', 'error');
    return;
  }

  try {
    // 发送投票交易
    // 注意：当前节点不支持 metadata，需要扩展
    // 临时方案：发送特殊交易到固定地址
    const res = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: wallet.address,
        to: '0x0000000000000000000000000000000000000002', // 投票地址
        amount: 0,
        gasPrice: 1,
        gasLimit: 21000,
        privateKey: wallet.privateKey,
        // 扩展字段（需要节点支持）
        metadata: {
          type: 'vote',
          proposalId: proposalId,
          choice: choice
        }
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`✅ 投票成功: ${choice}`, 'success');
      document.getElementById('vote-form').reset();
      closeVotePanel();

      // 更新本地统计（乐观更新）
      currentProposal.votes[choice]++;
      currentProposal.voters[wallet.address] = choice;
      renderProposalList();
    } else {
      throw new Error(data.error || '投票失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
  }
}

/**
 * 创建提案
 */
async function createProposal(event) {
  event.preventDefault();

  if (!wallet) {
    showToast('⚠️ 请先创建或导入钱包', 'error');
    return;
  }

  const title = document.getElementById('proposal-title').value.trim();
  const description = document.getElementById('proposal-desc').value.trim();
  const duration = parseInt(document.getElementById('proposal-duration').value);

  if (!title) {
    showToast('⚠️ 请输入提案标题', 'error');
    return;
  }

  try {
    // 获取当前区块高度作为 startBlock
    const chainRes = await fetch(`${API_BASE}/chain`);
    const chainData = await chainRes.json();
    const currentHeight = chainData.blocks ? chainData.blocks.length : 1;
    const endBlock = currentHeight + duration;

    // 发送提案创建交易
    // 特殊交易：发送到提案注册地址，amount=0，metadata 包含提案信息
    const res = await fetch(`${API_BASE}/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: wallet.address,
        to: '0x0000000000000000000000000000000000000001', // 提案注册地址
        amount: 0,
        gasPrice: 1,
        gasLimit: 21000,
        privateKey: wallet.privateKey,
        metadata: {
          type: 'proposal',
          title: title,
          description: description,
          endBlock: endBlock
        }
      })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`✅ 提案已发布! 哈希: ${data.hash.substring(0, 12)}...`, 'success');
      document.getElementById('proposal-form').reset();

      // 等待上链后刷新提案列表
      setTimeout(() => {
        scanProposals();
      }, 3000);
    } else {
      throw new Error(data.error || '发布失败');
    }
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
    console.error(e);
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
      if (msg.type === 'new_block' || msg.type === 'chain_update') {
        scanProposals();
        refreshVotingPower();
      }
    } catch (e) {
      console.error('WS error:', e);
    }
  };

  ws.onclose = () => {
    document.getElementById('status-dot').className = 'dot disconnected';
    document.getElementById('status-text').textContent = '未连接';
    setTimeout(connectWebSocket, 5000);
  };
}

/**
 * 显示 Toast
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';

  if (type === 'success') toast.style.background = 'var(--success)';
  else if (type === 'error') toast.style.background = 'var(--danger)';
  else toast.style.background = 'var(--text)';

  setTimeout(() => toast.classList.remove('show'), 3000);
}

/**
 * HTML 转义防 XSS
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 模态框控制
 */
function importWallet() {
  document.getElementById('import-modal').style.display = 'flex';
}

function closeImportModal() {
  document.getElementById('import-modal').style.display = 'none';
  document.getElementById('import-private-key').value = '';
}

function copyPrivateKey() {
  if (!wallet) return;
  navigator.clipboard.writeText(wallet.privateKey).then(() => {
    showToast('📋 私钥已复制', 'success');
  });
}

/**
 * 初始化
 */
function init() {
  const saved = localStorage.getItem('wallet');
  if (saved) {
    try {
      wallet = JSON.parse(saved);
      updateWalletUI();
      refreshVotingPower();
      scanProposals();
    } catch (e) {
      console.error('Load wallet failed:', e);
    }
  }

  connectWebSocket();
  scanProposals(); // 初始扫描

  // 每 10 秒刷新提案
  setInterval(scanProposals, 10000);
}

document.addEventListener('DOMContentLoaded', init);

document.getElementById('import-modal').addEventListener('click', (e) => {
  if (e.target.id === 'import-modal') closeImportModal();
});
