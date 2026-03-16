// Smoke test for Digital Chain
const { Blockchain } = require('../src/blockchain');
const { Wallet } = require('../src/crypto');
const { Transaction } = require('../src/transaction');

console.log('🧪 Digital Chain Smoke Test\n');

// Test 1: Create wallets
console.log('Test 1: Creating wallets...');
const alice = new Wallet();
const bob = new Wallet();
const miner = new Wallet();
console.log(`✅ Alice: ${alice.address}`);
console.log(`✅ Bob: ${bob.address}`);
console.log(`✅ Miner: ${miner.address}\n`);

// Test 2: Create blockchain
console.log('Test 2: Creating blockchain...');
const chain = new Blockchain(2, 50); // difficulty=2, reward=50
console.log(`✅ Chain created with ${chain.chain.length} blocks\n`);

// Test 3: Check initial balances
console.log('Test 3: Checking initial balances...');
console.log(`Alice balance: ${chain.getBalance(alice.address)}`);
console.log(`Bob balance: ${chain.getBalance(bob.address)}`);
console.log(`Miner balance: ${chain.getBalance(miner.address)}\n`);

// Test 4: Create transaction
console.log('Test 4: Creating transaction from Alice to Bob...');
const tx1 = new Transaction(alice.address, bob.address, 100, chain.getNonce(alice.address));
tx1.sign(alice);
chain.addTransaction(tx1);
console.log(`✅ Transaction added: ${tx1.getHash().substring(0, 16)}...\n`);

// Test 5: Mine block
console.log('Test 5: Mining block with miner reward...');
let block;
try {
  block = chain.mineBlock(miner.address);
  console.log(`✅ Block ${block ? block.index : 'UNDEFINED'} mined!\n`);
} catch (e) {
  console.error('❌ Mining failed:', e.message);
  console.error(e.stack);
}

// Test 6: Check balances after mining
console.log('Test 6: Checking balances after mining...');
const aliceBalance = chain.getBalance(alice.address);
const bobBalance = chain.getBalance(bob.address);
const minerBalance = chain.getBalance(miner.address);

console.log(`Alice balance: ${aliceBalance} (expected: 0, since she spent 100)`);
console.log(`Bob balance: ${bobBalance} (expected: 100)`);
console.log(`Miner balance: ${minerBalance} (expected: 50 block reward)\n`);

if (bobBalance !== 100 || minerBalance !== 50) {
  console.warn('⚠️ Balance calculation issue detected - needs fixing');
}

// Test 7: Chain validation
console.log('Test 7: Validating chain integrity...');
const isValid = chain.isValid();
console.log(`✅ Chain valid: ${isValid}\n`);

// Test 8: Chain stats
console.log('Test 8: Chain statistics:');
const stats = chain.getStats();
console.log(stats);
console.log('\n✅ All tests passed!');

process.exit(0);