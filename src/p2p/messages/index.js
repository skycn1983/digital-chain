/**
 * P2P 消息处理器集合
 * 在 P2PServer 中注册这些处理器
 */

const { Peer } = require('../peer');
const logger = require('../../utils/logger')('P2P-Messages');

/**
 * ping 处理器
 */
function handlePing(peer, payload) {
  // 立即回复 pong
  peer.pong(payload.nonce);
}

/**
 * pong 处理器
 */
function handlePong(peer, payload) {
  // 计算 RTT
  if (peer.lastPing) {
    peer.pingRtt = Date.now() - peer.lastPing;
    peer.lastPing = Date.now();
  }
}

/**
 * get_peers 处理器
 */
function handleGetPeers(p2pServer, peer, payload) {
  const peers = [];

  // 返回最近活跃的 peers
  for (const [id, p] of p2pServer.peers) {
    if (p !== peer && p.connectedAt > Date.now() - 10 * 60 * 1000) {
      peers.push({
        nodeId: p.id,
        address: p.address,
        chainHeight: p.chainHeight,
        lastSeen: Date.now() - p.getUptime()
      });
    }
  }

  // 随机打乱并限制数量
  peers.sort(() => Math.random() - 0.5);
  const selected = peers.slice(0, 10);

  peer.send('peers', { peers: selected });
}

/**
 * peers 处理器（收到 peer 列表）
 */
function handlePeers(p2pServer, peer, payload) {
  logger.debug(`Received ${payload.peers.length} peers from ${peer.id}`);

  for (const peerInfo of payload.peers) {
    if (p2pServer.peersByAddress.has(peerInfo.address)) {
      continue; // 已连接
    }

    // 加入重连队列（低优先级，延迟连接）
    p2pServer.reconnectQueue.push({
      address: peerInfo.address,
      attempts: 0,
      lastAttempt: 0
    });
  }
}

/**
 * get_blocks 处理器
 */
function handleGetBlocks(p2pServer, peer, payload, blockchain) {
  const { fromHeight, limit } = payload;

  if (typeof fromHeight !== 'number' || fromHeight < 0) {
    peer.send('error', { code: 4001, message: 'Invalid fromHeight' });
    return;
  }

  if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
    peer.send('error', { code: 4002, message: 'Invalid limit' });
    return;
  }

  // 收集区块
  const blocks = [];
  for (let i = fromHeight; i < blockchain.chain.length && blocks.length < limit; i++) {
    const block = blockchain.chain[i];
    blocks.push(block.serialize());
  }

  peer.send('blocks', {
    blocks,
    totalCount: blockchain.chain.length - fromHeight
  });

  logger.debug(`Sent ${blocks.length} blocks to ${peer.id} (from ${fromHeight})`);
}

/**
 * blocks 处理器（收到区块列表）
 */
function handleBlocks(p2pServer, peer, payload, blockchain) {
  const { blocks } = payload;

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return; // 空列表，忽略
  }

  logger.debug(`Received ${blocks.length} blocks from ${peer.id}`);

  // 使用 fork choice 处理区块序列
  if (p2pServer.forkChoice) {
    for (const blockData of blocks) {
      try {
        const { Block } = require('../../block');
        const block = Block.deserialize(blockData);

        // 基础验证
        if (block.hash !== block.calculateHash()) {
          logger.warn(`Block hash invalid from ${peer.id}, stopping sync`);
          break;
        }

        if (!block.hash.startsWith('0'.repeat(block.difficulty))) {
          logger.warn(`Block difficulty not met from ${peer.id}, stopping sync`);
          break;
        }

        // 交给 fork choice 处理
        const result = p2pServer.forkChoice.addBlock(block);

        if (!result.accepted) {
          // 停止处理后续区块
          break;
        }

      } catch (e) {
        logger.error(`Failed to process block from ${peer.id}:`, e.message);
        break;
      }
    }
  } else {
    // 降级处理：简单追加（无分叉检测）
    for (const blockData of blocks) {
      try {
        const { Block } = require('../../block');
        const block = Block.deserialize(blockData);

        if (block.index === blockchain.chain.length && block.previousHash === blockchain.getLatestBlock().hash) {
          blockchain.chain.push(block);
          blockchain.pendingTransactions = [];
          blockchain.adjustDifficulty();
          blockchain.save();
        } else {
          break; // 停止同步
        }
      } catch (e) {
        break;
      }
    }
  }

  // 保存区块链
  blockchain.save();
}

/**
 * tx_broadcast 处理器（收到交易广播）
 */
function handleTxBroadcast(p2pServer, peer, payload, blockchain) {
  const txData = payload.transaction;

  try {
    const { Transaction } = require('../../transaction');
    const tx = Transaction.deserialize(txData);

    // 验证签名
    // 必须包含 publicKey 字段
    if (!tx.publicKey) {
      throw new Error('Transaction missing publicKey for signature verification');
    }

    // 验证公钥是否匹配 from 地址
    const crypto = require('../../crypto');
    const derivedAddress = '0x' + crypto.createHash('ripemd160')
      .update(Buffer.from(tx.publicKey, 'hex')).digest('hex');
    if (derivedAddress !== tx.from) {
      throw new Error('PublicKey does not match from address');
    }

    // 验证签名
    const hash = tx.getHash();
    const { verify } = require('../../crypto');
    if (!verify(hash, tx.signature, tx.publicKey)) {
      throw new Error('Invalid transaction signature');
    }

    // 检查是否已存在
    const exists = blockchain.pendingTransactions.some(t => t.getHash() === tx.getHash());
    if (exists) {
      return; // 已存在，忽略
    }

    // 检查余额
    const balance = blockchain.getBalance(tx.from);
    const pendingAmount = blockchain.pendingTransactions
      .filter(t => t.from === tx.from)
      .reduce((sum, t) => sum + t.amount + (t.gasPrice * t.gasLimit), 0);

    if (balance - pendingAmount < tx.amount) {
      throw new Error('Insufficient balance');
    }

    // 检查 nonce
    const nonce = blockchain.getNonce(tx.from);
    if (tx.nonce !== nonce) {
      throw new Error(`Invalid nonce: expected ${nonce}, got ${tx.nonce}`);
    }

    // 最小交易金额和 Gas 费检查
    const MIN_AMOUNT = 1;
    const MIN_FEE = 1;
    if (tx.amount < MIN_AMOUNT) {
      throw new Error('Transaction amount too small');
    }
    if (tx.gasPrice * tx.gasLimit < MIN_FEE) {
      throw new Error('Gas fee too low');
    }

    // 加入交易池
    blockchain.addTransaction(tx);

    logger.debug(`Accepted transaction ${tx.getHash().substring(0, 12)} from ${peer.id}`);

    // 继续广播（转发给其他 peers，不包括来源 peer）
    p2pServer.broadcast('tx_broadcast', { transaction: txData }, peer);

  } catch (e) {
    logger.warn(`Rejected transaction from ${peer.id}:`, e.message);
    // 发送错误响应（可选）
    peer.send('error', { code: 2001, message: e.message });
  }
}

/**
 * new_block 处理器（收到新区块广播）
 */
function handleNewBlock(p2pServer, peer, payload, blockchain) {
  const blockData = payload.block;

  try {
    const { Block } = require('../../block');
    const block = Block.deserialize(blockData);

    // 使用 fork choice 算法处理新区块
    if (p2pServer.forkChoice) {
      const result = p2pServer.forkChoice.addBlock(block);

      if (result.accepted) {
        // 保存区块链状态
        blockchain.save();

        if (result.switched) {
          logger.info(`Switched to fork: new height ${blockchain.chain.length}`);
        } else {
          logger.info(`Accepted new block #${block.index} from ${peer.id}`);
        }
      } else {
        logger.warn(`Block rejected by fork choice: #${block.index} from ${peer.id}`);
      }
    } else {
      // 降级处理：简单追加逻辑
      if (block.index === blockchain.chain.length) {
        if (block.previousHash === blockchain.getLatestBlock().hash) {
          blockchain.chain.push(block);
          blockchain.pendingTransactions = [];
          blockchain.adjustDifficulty();
          blockchain.save();
          logger.info(`Accepted new block #${block.index} (no fork choice)`);
        } else {
          logger.warn(`Fork detected but no fork choice handler`);
        }
      } else {
        logger.warn(`Block index mismatch: expected ${blockchain.chain.length}, got ${block.index}`);
      }
    }

  } catch (e) {
    logger.error(`Failed to process new block from ${peer.id}:`, e.message);
  }
}

/**
 * error 处理器
 */
function handleError(peer, payload) {
  logger.warn(`Error from ${peer.id}: [${payload.code}] ${payload.message}`);
}

/**
 * new_transaction 处理器（兼容 WebSocket 事件，转发为 tx_broadcast）
 */
function handleNewTransaction(p2pServer, peer, payload, blockchain) {
  // 直接调用 tx_broadcast 处理器
  return handleTxBroadcast(p2pServer, peer, { transaction: payload }, blockchain);
}

module.exports = {
  handlePing,
  handlePong,
  handleGetPeers,
  handlePeers,
  handleGetBlocks,
  handleBlocks,
  handleTxBroadcast,
  handleNewBlock,
  handleError,
  handleNewTransaction
};
