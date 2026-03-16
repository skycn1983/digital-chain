/**
 * Transaction builder for Digital Chain
 */

import { sha256 } from './utils/crypto';
import { sign, privateKeyToPublicKey } from './utils/crypto';
import { SerializedTransaction, TransactionOptions } from './types';

export class Transaction {
  public readonly from: string;
  public readonly to: string;
  public readonly amount: number;
  public readonly gasPrice: number;
  public readonly gasLimit: number;
  public readonly data: string;
  public readonly timestamp: number;
  public nonce?: number;

  private _signature?: string;
  private _publicKey?: string;

  constructor(options: TransactionOptions) {
    this.from = options.from;
    this.to = options.to;
    this.amount = options.amount;
    this.gasPrice = options.gasPrice ?? 1;
    this.gasLimit = options.gasLimit ?? 21000;
    this.data = options.data ?? '';
    this.timestamp = Date.now();
    this.nonce = options.nonce;
  }

  /**
   * Get transaction hash
   */
  getHash(): string {
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

  /**
   * Get transaction fee
   */
  getFee(): number {
    return this.gasPrice * this.gasLimit;
  }

  /**
   * Sign transaction with wallet
   */
  sign(walletPrivateKey: string): void {
    const hash = this.getHash();
    this._signature = sign(walletPrivateKey, hash);
    
    // 需要公钥用于验证
    this._publicKey = privateKeyToPublicKey(walletPrivateKey);
  }

  /**
   * Get signature (if signed)
   */
  getSignature(): string | undefined {
    return this._signature;
  }

  /**
   * Get public key (if signed)
   */
  getPublicKey(): string | undefined {
    return this._publicKey;
  }

  /**
   * Check if transaction is signed
   */
  isSigned(): boolean {
    return !!this._signature && !!this._publicKey;
  }

  /**
   * Serialize for network transmission
   */
  serialize(): SerializedTransaction {
    const data: SerializedTransaction = {
      hash: this.getHash(),
      from: this.from,
      to: this.to,
      amount: this.amount,
      nonce: this.nonce!,
      gasPrice: this.gasPrice,
      gasLimit: this.gasLimit,
      timestamp: this.timestamp,
      signature: this._signature,
      publicKey: this._publicKey
    };
    return data;
  }

  /**
   * Deserialize from serialized data
   */
  static deserialize(data: SerializedTransaction): Transaction {
    const tx = new Transaction({
      from: data.from,
      to: data.to,
      amount: data.amount,
      gasPrice: data.gasPrice,
      gasLimit: data.gasLimit,
      nonce: data.nonce
    });
    
    // 恢复时间和签名
    // @ts-ignore
    tx.timestamp = data.timestamp;
    tx._signature = data.signature;
    tx._publicKey = data.publicKey;
    
    return tx;
  }

  /**
   * Validate transaction fields
   */
  validate(): boolean {
    if (!this.from || !this.to) return false;
    if (this.amount <= 0) return false;
    if (this.gasPrice < 1) return false;
    if (this.gasLimit < 21000) return false;
    if (this.nonce === undefined) return false;
    return true;
  }
}
