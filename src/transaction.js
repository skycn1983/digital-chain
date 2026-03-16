const { sha256 } = require('./crypto');

class Transaction {
  constructor(from, to, amount, nonce = 0, gasPrice = 1, gasLimit = 21000, data = '') {
    this.from = from;          // sender address
    this.to = to;             // recipient address
    this.amount = amount;     // amount to transfer
    this.nonce = nonce;       // transaction sequence number
    this.gasPrice = gasPrice; // price per gas unit
    this.gasLimit = gasLimit; // max gas allowed
    this.data = data;         // contract data or empty
    this.timestamp = Date.now();
    this.signature = null;
  }

  // Create transaction hash (for signing)
  getHash() {
    const txData = {
      from: this.from,
      to: this.to,
      amount: this.amount,
      nonce: this.nonce,
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      data: this.data,
      timestamp: this.timestamp
    };
    return sha256(JSON.stringify(txData));
  }

  // Sign transaction with wallet
  sign(wallet) {
    const hash = this.getHash();
    this.signature = wallet.sign(hash);
    return this.signature;
  }

  // Verify transaction signature
  verify() {
    if (!this.signature) return false;
    const hash = this.getHash();
    // Simplified verification - would need wallet's public key
    return true; // Placeholder
  }

  // Calculate transaction fee
  getFee() {
    return this.gasPrice * this.gasLimit;
  }

  // Serialize for storage/network
  serialize() {
    const data = {
      from: this.from,
      to: this.to,
      amount: this.amount,
      nonce: this.nonce,
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      data: this.data,
      timestamp: this.timestamp,
      signature: this.signature,
      hash: this.getHash()
    };
    // 如果存在 publicKey，包含它（用于 P2P 签名验证）
    if (this.publicKey) {
      data.publicKey = this.publicKey;
    }
    return data;
  }

  static deserialize(data) {
    const tx = new Transaction(
      data.from,
      data.to,
      data.amount,
      data.nonce,
      data.gasPrice,
      data.gasLimit,
      data.data
    );
    tx.timestamp = data.timestamp;
    tx.signature = data.signature;
    // 如果包含 publicKey 则恢复
    if (data.publicKey) {
      tx.publicKey = data.publicKey;
    }
    return tx;
  }
}

/**
 * Verify transaction signature using public key
 * @param {Transaction} tx
 * @returns {boolean}
 */
function verifyTransactionSignature(tx) {
  if (!tx.signature) {
    return false;
  }

  // 如果交易包含 publicKey，直接使用
  if (tx.publicKey) {
    return verifyWithPublicKey(tx, tx.publicKey);
  }

  // 否则尝试从签名恢复公钥（更复杂）
  // 对于当前演示，我们暂时返回 false，需要确保交易包含 publicKey
  return false;
}

/**
 * Verify using explicit public key
 * @param {Transaction} tx
 * @param {string} publicKeyHex
 */
function verifyWithPublicKey(tx, publicKeyHex) {
  try {
    const crypto = require('./crypto');
    const hash = tx.getHash();
    return crypto.verify(hash, tx.signature, publicKeyHex);
  } catch (e) {
    return false;
  }
}

module.exports = {
  Transaction,
  verifyTransactionSignature
};