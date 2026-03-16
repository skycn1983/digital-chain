#!/usr/bin/env node

/**
 * Quick balance debug
 */

import { Wallet, Blockchain } from './dist/index.js';

const miner = new Wallet('0xfc2e049dfe99ccc3e4ba5b5cfa0f94d6a76c0f2a'); // 从测试输出中获取
const chain = new Blockchain({ difficulty: 2, blockReward: 50 });
chain.load();

console.log('Miner address:', miner.address);
console.log('Chain height:', chain.chain.length);

// Print all transactions
chain.chain.forEach((blk, idx) => {
  console.log(`\nBlock ${idx}:`);
  blk.transactions.forEach(tx => {
    console.log(`  tx: from=${tx.from.substring(0,12)}... to=${tx.to.substring(0,12)}... amount=${tx.amount}`);
    console.log(`      (from is miner? ${tx.from === miner.address}, to is miner? ${tx.to === miner.address})`);
  });
});

// Calculate balance manually
let manualBalance = 0;
for (const blk of chain.chain) {
  for (const tx of blk.transactions) {
    if (tx.from === '0x0000000000000000000000000000000000000000') {
      if (tx.to === miner.address) {
        manualBalance += tx.amount;
        console.log(`  +${tx.amount} (coinbase)`);
      }
    } else {
      if (tx.from === miner.address) {
        manualBalance -= tx.amount;
        manualBalance -= tx.gasPrice * tx.gasLimit;
        console.log(`  -${tx.amount} (send, gas ${tx.gasPrice * tx.gasLimit})`);
      }
      if (tx.to === miner.address) {
        manualBalance += tx.amount;
        console.log(`  +${tx.amount} (receive)`);
      }
    }
  }
}

console.log('\nManual balance:', manualBalance);
console.log('SDK balance:', chain.getBalance(miner.address));
