/**
 * Handshake 消息处理
 */

class Handshake {
  constructor(data) {
    this.protocolVersion = data.protocolVersion;
    this.nodeId = data.nodeId;
    this.address = data.address;
    this.chainHeight = data.chainHeight;
    this.difficulty = data.difficulty;
    this.blockReward = data.blockReward;
    this.userAgent = data.userAgent;

    this.data = data; // 保留原始数据
  }

  /**
   * 验证握手数据
   */
  validate() {
    const errors = [];

    if (!this.protocolVersion) errors.push('protocolVersion required');
    if (!this.nodeId) errors.push('nodeId required');
    if (!this.address) errors.push('address required');
    if (typeof this.chainHeight !== 'number' || this.chainHeight < 0) errors.push('invalid chainHeight');
    if (typeof this.difficulty !== 'number' || this.difficulty < 1) errors.push('invalid difficulty');
    if (typeof this.blockReward !== 'number' || this.blockReward < 0) errors.push('invalid blockReward');

    if (errors.length > 0) {
      throw new Error('Handshake validation failed: ' + errors.join(', '));
    }
  }

  /**
   * 检查协议版本兼容性
   * @param {string} supportedVersion - 支持的版本
   */
  isCompatible(supportedVersion = '0.1') {
    return this.protocolVersion === supportedVersion;
  }
}

module.exports = { Handshake };
