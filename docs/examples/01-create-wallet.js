#!/usr/bin/env node

/**
 * 示例 1: 创建钱包
 * 
 * 演示如何生成新的secp256k1密钥对和地址
 */

const { Wallet } = require('../src/crypto');

console.log('🔐 创建新钱包...\n');

// 创建钱包（自动生成密钥对）
const wallet = new Wallet();

console.log('地址:', wallet.address);
console.log('公钥:', wallet.publicKey.substring(0, 40) + '...');
console.log('私钥:', wallet.privateKey);
console.log('\n⚠️  请妥善保存私钥！丢失无法恢复！');

// 导出为JSON（不含私钥）
const walletInfo = wallet.toJSON();
console.log('\n钱包信息 (JSON):');
console.log(JSON.stringify(walletInfo, null, 2));

// 从私钥导入
console.log('\n📥 从私钥导入...');
const imported = new Wallet(wallet.privateKey);
console.log('导入地址:', imported.address);
console.log('地址匹配:', imported.address === wallet.address ? '✅' : '❌');
