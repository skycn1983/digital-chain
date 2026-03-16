/**
 * Crypto utilities for Digital Chain SDK
 * Reuses the same algorithms as the blockchain core
 */

import * as crypto from 'crypto';
const { ec } = require('elliptic');

const secp256k1 = new ec('secp256k1');

/**
 * SHA256 hash
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate random bytes
 */
export function randomBytes(length: number = 32): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Derive address from public key (RIPEMD160 of SHA256)
 * Matches blockchain implementation
 */
export function deriveAddress(publicKeyHex: string): string {
  const hash = crypto.createHash('ripemd160')
    .update(Buffer.from(publicKeyHex, 'hex'))
    .digest('hex');
  return '0x' + hash;
}

/**
 * Verify ECDSA signature
 */
export function verify(hash: string, signatureHex: string, publicKeyHex: string): boolean {
  try {
    const msgHash = Buffer.from(hash, 'hex');
    const publicKey = secp256k1.keyFromPublic(publicKeyHex, 'hex');
    return publicKey.verify(msgHash, signatureHex);
  } catch (e) {
    return false;
  }
}

/**
 * Sign message with private key
 */
export function sign(privateKeyHex: string, message: string): string {
  const key = secp256k1.keyFromPrivate(privateKeyHex);
  const msgHash = crypto.createHash('sha256').update(message).digest();
  const signature = key.sign(msgHash);
  return signature.toDER('hex');
}

/**
 * Generate keypair
 */
export function generateKeypair(): { privateKey: string; publicKey: string } {
  const keypair = secp256k1.genKeyPair();
  const privateKey = keypair.getPrivate('hex');
  const publicKey = keypair.getPublic().encode('hex', false); // uncompressed
  return { privateKey, publicKey };
}

/**
 * Validate Ethereum-style address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Private key to public key
 */
export function privateKeyToPublicKey(privateKeyHex: string): string {
  const keypair = secp256k1.keyFromPrivate(privateKeyHex);
  return keypair.getPublic().encode('hex', false);
}
