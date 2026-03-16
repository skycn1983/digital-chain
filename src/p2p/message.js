/**
 * P2P 消息编解码
 * 使用长度前缀帧格式: [4-byte length][JSON payload]
 */

const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * 编码消息为 Buffer
 * @param {Object} message - 消息对象 {type, payload, timestamp, nodeId?}
 * @returns {Buffer}
 */
function encode(message) {
  if (!message.type) {
    throw new Error('Message must have type');
  }

  // 确保 timestamp 存在
  if (!message.timestamp) {
    message.timestamp = Date.now();
  }

  // 序列化为 JSON
  const json = JSON.stringify(message);

  if (json.length > MAX_MESSAGE_SIZE) {
    throw new Error(`Message size exceeds limit: ${json.length} bytes`);
  }

  // 创建长度前缀 (4 bytes, big-endian)
  const length = Buffer.alloc(4);
  length.writeUInt32BE(Buffer.byteLength(json, 'utf8'), 0);

  // 合并: [length][json]
  const payload = Buffer.from(json, 'utf8');
  return Buffer.concat([length, payload]);
}

/**
 * 解码 Buffer 为消息
 * @param {Buffer} buffer - 包含完整消息的 buffer
 * @returns {Object} 消息对象
 */
function decode(buffer) {
  // 至少需要 4 字节长度头
  if (buffer.length < 4) {
    throw new Error('Buffer too short for length prefix');
  }

  // 读取长度
  const length = buffer.readUInt32BE(0);
  const jsonLength = 4 + length;

  if (buffer.length < jsonLength) {
    throw new Error('Buffer incomplete, expected ' + jsonLength + ' bytes');
  }

  // 提取 JSON
  const json = buffer.slice(4, jsonLength).toString('utf8');

  try {
    const message = JSON.parse(json);

    // 基本验证
    if (!message.type) {
      throw new Error('Message missing type field');
    }

    return message;
  } catch (e) {
    throw new Error('Failed to parse message JSON: ' + e.message);
  }
}

/**
 * 从 socket 流中读取完整消息（支持粘包/拆包）
 * 使用简单的状态机解析长度前缀帧
 */
class MessageReader {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.handlers = new Map();
  }

  /**
   * 注册消息类型处理器
   * @param {string} type - 消息类型
   * @param {Function} handler - (message) => void
   */
  on(type, handler) {
    this.handlers.set(type, handler);
  }

  /**
   * 开始读取
   */
  start() {
    this.socket.on('data', (chunk) => {
      // 追加到缓冲区
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    this.socket.on('close', () => {
      this.handlers.clear();
    });

    this.socket.on('error', (err) => {
      console.error('MessageReader socket error:', err.message);
    });
  }

  /**
   * 处理缓冲区中的消息
   */
  processBuffer() {
    while (true) {
      // 检查是否至少有 4 字节长度头
      if (this.buffer.length < 4) {
        break;
      }

      // 读取消息长度
      const length = this.buffer.readUInt32BE(0);
      const totalLength = 4 + length;

      // 检查是否完整
      if (this.buffer.length < totalLength) {
        break;
      }

      // 提取消息
      const messageBuffer = this.buffer.slice(0, totalLength);
      this.buffer = this.buffer.slice(totalLength);

      try {
        const message = decode(messageBuffer);

        // 调用处理器
        const handler = this.handlers.get(message.type);
        if (handler) {
          try {
            handler(message);
          } catch (e) {
            console.error(`Handler error for ${message.type}:`, e.message);
          }
        } else {
          console.warn(`No handler for message type: ${message.type}`);
        }
      } catch (e) {
        console.error('Failed to decode message:', e.message);
        // 错误消息，断开连接
        this.socket.destroy();
        break;
      }
    }
  }
}

/**
 * 发送消息到 socket
 * @param {Object} socket - net.Socket
 * @param {Object} message - 消息对象
 */
function send(socket, message) {
  const buffer = encode(message);
  socket.write(buffer);
}

module.exports = {
  encode,
  decode,
  MessageReader,
  send,
  MAX_MESSAGE_SIZE
};
