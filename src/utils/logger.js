/**
 * 简单日志工具
 * @param {string} namespace - 命名空间
 */

const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

let currentLevel = process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LEVELS.INFO;

function setLevel(level) {
  currentLevel = level;
}

function logger(namespace) {
  const prefix = `[${namespace}]`;

  return {
    debug: (...args) => {
      if (currentLevel <= LEVELS.DEBUG) {
        console.log(new Date().toISOString(), prefix, ...args);
      }
    },
    info: (...args) => {
      if (currentLevel <= LEVELS.INFO) {
        console.log(new Date().toISOString(), prefix, ...args);
      }
    },
    warn: (...args) => {
      if (currentLevel <= LEVELS.WARN) {
        console.warn(new Date().toISOString(), prefix, ...args);
      }
    },
    error: (...args) => {
      if (currentLevel <= LEVELS.ERROR) {
        console.error(new Date().toISOString(), prefix, ...args);
      }
    }
  };
}

module.exports = logger;
module.exports.LEVELS = LEVELS;
