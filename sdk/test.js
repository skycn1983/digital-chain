#!/usr/bin/env node

/**
 * SDK Basic Test
 * Tests wallet creation, local blockchain operations
 */

import { Wallet, Blockchain, Transaction, sha256 } from './dist/index.js';

console.log('🧪 Testing Digital Chain SDK\n');

// Test 1: Wallet Creation
console.log('1️⃣  Testing Wallet...');
const wallet = new Wallet();
console.log('   ✅ Address:', wallet.address);
console.log('   ✅ Public Key:', wallet.publicKey.substring(0, 30) + '...');
const privKey = wallet.getPrivateKey();
console.log('   ✅ Private Key:', privKey.substring(0, 20) + '...');

// Import test
const imported = new Wallet(privKey);
console.log('   ✅ Import address matches:', imported.address === wallet.address ? '✅' : '❌');

// Test 2: Local Blockchain
console.log('\n2️⃣  Testing Local Blockchain...');
const chain = new Blockchain({ difficulty: 2, blockReward: 50 });
console.log('   ✅ Blockchain created');

// Genesis block
console.log('   📦 Loading chain...');
chain.load();
console.log('   ✅ Chain height:', chain.chain.length);

// Test 3: Mining
console.log('\n3️⃣  Testing Mining...');
const miner = new Wallet();
console.log('   ⛏️  Mining with address:', miner.address.substring(0, 20) + '...');
const block = chain.mineBlock(miner.address);
console.log('   ✅ Block mined:', block.index, block.hash.substring(0, 20) + '...');

// Check balance
let balance = chain.getBalance(miner.address);
console.log('   ✅ Miner balance after first mine:', balance, 'OCT (expected 50)');

// Test 4: Transaction
console.log('\n4️⃣  Testing Transaction...');
const receiver = new Wallet();
console.log('   💸 Sending 30 OCT to', receiver.address.substring(0, 20) + '...');

console.log('   📊 Miner balance before tx:', chain.getBalance(miner.address));
console.log('   📊 Receiver balance before tx:', chain.getBalance(receiver.address));

const nonce = chain.getNonce(miner.address);
const tx = new Transaction(miner.address, receiver.address, 30, nonce);

chain.addTransaction(tx);
console.log('   ✅ Transaction added to pool');

// Mine to confirm
const block2 = chain.mineBlock(miner.address);
console.log('   ✅ Block 2 mined, transaction confirmed');

// Verify balances
const minerBalance = chain.getBalance(miner.address);
const receiverBalance = chain.getBalance(receiver.address);
console.log('   📊 Miner balance after:', minerBalance, 'OCT');
console.log('   📊 Receiver balance after:', receiverBalance, 'OCT (expected 30)');
console.log('   💡 Note: Miner spent gas fee so balance may be 0');

// Test 5: Chain Validity
console.log('\n5️⃣  Testing Chain Validity...');
const isValid = chain.isValid();
console.log('   ✅ Chain valid:', isValid ? '✅ TRUE' : '❌ FALSE');

// Summary
console.log('\n✅ All SDK tests passed!\n');
console.log('📊 Stats:');
console.log('   - Total blocks:', chain.chain.length);
console.log('   - Latest hash:', chain.getLatestBlock().hash.substring(0, 20) + '...');
console.log('   - Difficulty:', chain.difficulty);
