const crypto = require('crypto');
const ec = require('elliptic').ec;
const secp256k1 = new ec('secp256k1');

// SHA256 hash
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Generate random bytes
function randomBytes(length = 32) {
  return crypto.randomBytes(length);
}

class Wallet {
  constructor(privateKey = null) {
    if (privateKey) {
      this.privateKey = privateKey;
      this.keyPair = this._importPrivateKey(privateKey);
      this.publicKey = this._getPublicKeyHex(this.keyPair.getPublic());
      this.address = this._deriveAddress(this.publicKey);
    } else {
      this.keyPair = secp256k1.genKeyPair();
      this.privateKey = this.keyPair.getPrivate('hex');
      this.publicKey = this._getPublicKeyHex(this.keyPair.getPublic());
      this.address = this._deriveAddress(this.publicKey);
    }
  }

  _importPrivateKey(hex) {
    const key = secp256k1.keyFromPrivate(hex);
    return key;
  }

  _getPublicKeyHex(publicKey) {
    // Get uncompressed public key (65 bytes: 0x04 + x + y)
    return publicKey.encode('hex', false);
  }

  _deriveAddress(publicKey) {
    // SHA256 then RIPEMD160 (Bitcoin-style)
    const hash = crypto.createHash('ripemd160').update(Buffer.from(publicKey, 'hex')).digest('hex');
    return '0x' + hash;
  }

  sign(message) {
    const msgHash = crypto.createHash('sha256').update(message).digest();
    const signature = this.keyPair.sign(msgHash);
    // DER format signature
    return signature.toDER('hex');
  }

  verify(message, signature, publicKeyHex = this.publicKey) {
    try {
      const msgHash = crypto.createHash('sha256').update(message).digest();
      const publicKey = secp256k1.keyFromPublic(publicKeyHex, 'hex');
      return publicKey.verify(msgHash, signature);
    } catch (e) {
      return false;
    }
  }

  toJSON() {
    return {
      address: this.address,
      publicKey: this.publicKey,
      // Never expose private key in JSON
    };
  }
}

module.exports = {
  Wallet,
  sha256,
  randomBytes
};