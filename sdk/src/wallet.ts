/**
 * Wallet class for Digital Chain
 * Manages key generation, signing, and address derivation
 */

import {
  generateKeypair,
  privateKeyToPublicKey,
  deriveAddress,
  isValidAddress,
  sign as signMessage
} from './utils/crypto';

export interface WalletInfo {
  address: string;
  publicKey: string;
}

export class Wallet {
  private privateKey: string;
  public readonly publicKey: string;
  public readonly address: string;

  /**
   * Private constructor - use factory methods
   */
  private constructor(privateKey: string, publicKey: string, address: string) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = address;
  }

  /**
   * Create new wallet (generate random keys)
   */
  static generate(): Wallet {
    const { privateKey, publicKey } = generateKeypair();
    const address = deriveAddress(publicKey);
    return new Wallet(privateKey, publicKey, address);
  }

  /**
   * Import wallet from private key
   */
  static fromPrivateKey(privateKey: string): Wallet {
    const publicKey = privateKeyToPublicKey(privateKey);
    const address = deriveAddress(publicKey);
    return new Wallet(privateKey, publicKey, address);
  }

  /**
   * Import wallet from public key (read-only, cannot sign)
   */
  static fromPublicKey(publicKey: string): Wallet {
    const address = deriveAddress(publicKey);
    return new Wallet('', publicKey, address);
  }

  /**
   * Sign a message (string)
   */
  sign(message: string): string {
    if (!this.privateKey) {
      throw new Error('Cannot sign: wallet has no private key');
    }
    return signMessage(this.privateKey, message);
  }

  /**
   * Get private key (WARNING: Use with caution!)
   */
  exportPrivateKey(): string {
    if (!this.privateKey) {
      throw new Error('Wallet has no private key');
    }
    return this.privateKey;
  }

  /**
   * Check if wallet can sign (has private key)
   */
  canSign(): boolean {
    return !!this.privateKey;
  }

  /**
   * Export wallet info (address and public key only)
   */
  toJSON(): WalletInfo {
    return {
      address: this.address,
      publicKey: this.publicKey
    };
  }

  /**
   * Validate address format
   */
  static isValidAddress(address: string): boolean {
    return isValidAddress(address);
  }
}
