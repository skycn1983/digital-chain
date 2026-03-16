#!/usr/bin/env node

/**
 * Digital Chain 代币转账 DApp
 * 使用本地 SDK 与数字链节点交互
 */

const { DigitalChainClient } = require('../../sdk');
const readline = require('readline');

// 默认节点配置
const DEFAULT_NODE = process.env.DIGITAL_CHAIN_NODE || 'http://localhost:3000';

// CLI 命令处理
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    return;
  }

  const client = new DigitalChainClient(DEFAULT_NODE);

  try {
    switch (command) {
      case 'create-wallet':
        await createWallet(client);
        break;
      case 'balance':
        await getBalance(client, args);
        break;
      case 'send':
        await sendTransaction(client, args);
        break;
      case 'mine':
        await mineBlock(client, args);
        break;
      case 'nonce':
        await getNonce(client, args);
        break;
      case 'chain':
        await getChainInfo(client);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

async function createWallet(client) {
  const wallet = await client.createWallet();
  console.log('✅ Wallet created:');
  console.log(`   Address: ${wallet.address}`);
  console.log(`   Public Key: ${wallet.publicKey}`);
  console.log(`   Private Key: ${wallet.privateKey}`);
  console.log('');
  console.log('⚠️  Save your private key securely! It cannot be recovered.');
}

async function getBalance(client, args) {
  const address = extractArg(args, '--address');
  if (!address) {
    console.error('❌ Missing --address');
    process.exit(1);
  }
  const balance = await client.getBalance(address);
  console.log(`✅ Balance of ${address}: ${balance} OCT`);
}

async function getNonce(client, args) {
  const address = extractArg(args, '--address');
  if (!address) {
    console.error('❌ Missing --address');
    process.exit(1);
  }
  const nonce = await client.getNonce(address);
  console.log(`✅ Nonce of ${address}: ${nonce}`);
}

async function mineBlock(client, args) {
  const minerAddress = extractArg(args, '--miner-address');
  if (!minerAddress) {
    console.error('❌ Missing --miner-address');
    process.exit(1);
  }
  console.log(`⛏️  Mining block with miner ${minerAddress}...`);
  const block = await client.mineBlock(minerAddress);
  console.log(`✅ Block mined: #${block.index} (hash: ${block.hash.substring(0, 16)}...)`);
  console.log(`   Transactions: ${block.transactions.length}`);
  console.log(`   Reward: 50 OCT`);
}

async function sendTransaction(client, args) {
  const from = extractArg(args, '--from');
  const to = extractArg(args, '--to');
  const amount = parseInt(extractArg(args, '--amount'));
  const privateKey = extractArg(args, '--privateKey');
  const gasPrice = parseInt(extractArg(args, '--gasPrice')) || 1;
  const gasLimit = parseInt(extractArg(args, '--gasLimit')) || 21000;

  if (!from || !to || !amount || !privateKey) {
    console.error('❌ Missing required parameters: --from, --to, --amount, --privateKey');
    process.exit(1);
  }

  if (isNaN(amount) || amount <= 0) {
    console.error('❌ Invalid amount');
    process.exit(1);
  }

  console.log(`💸 Sending ${amount} OCT from ${from.substring(0, 12)}... to ${to.substring(0, 12)}...`);

  try {
    const tx = await client.sendTransaction({
      from,
      to,
      amount,
      gasPrice,
      gasLimit,
      privateKey
    });

    console.log('✅ Transaction sent!');
    console.log(`   Hash: ${tx.hash}`);
    console.log(`   Nonce: ${tx.nonce}`);
    console.log(`   Fee: ${tx.gasPrice * tx.gasLimit} OCT`);
    console.log('');
    console.log('⏳ Waiting for confirmation...');
    await waitForConfirmation(client, tx.hash);
  } catch (error) {
    if (error.message.includes('nonce')) {
      console.error(`❌ Nonce error: ${error.message}`);
      console.log('   Use --nonce flag to specify correct nonce, or check pending transactions.');
    } else {
      throw error;
    }
  }
}

async function waitForConfirmation(client, txHash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const chain = await client.getChainInfo();
    const confirmed = chain.blocks.some(block =>
      block.transactions.some(tx => tx.hash === txHash)
    );
    if (confirmed) {
      console.log('✅ Transaction confirmed in blockchain!');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  console.log('⚠️  Transaction not confirmed yet (chain length unchanged)');
}

async function getChainInfo(client) {
  const info = await client.getChainInfo();
  console.log('📊 Chain Info:');
  console.log(`   Height: ${info.blocks.length}`);
  console.log(`   Difficulty: ${info.difficulty}`);
  console.log(`   Block Reward: ${info.reward} OCT`);
  console.log(`   Latest Hash: ${info.latestHash.substring(0, 16)}...`);
  console.log(`   Pending Transactions: ${info.pendingTx}`);
  console.log(`   Valid: ${info.valid ? '✅' : '❌'}`);
}

function extractArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return null;
}

function printUsage() {
  console.log(`
🔹 Digital Chain Transfer DApp

Usage:
  node transfer-dapp.js <command> [options]

Commands:
  create-wallet              Create a new wallet
  balance --address <addr>   Get balance of an address
  nonce --address <addr>     Get nonce (transaction count) of an address
  mine --miner-address <addr> Mine a new block (reward goes to miner)
  send                      Send a transaction
    --from <address>        Sender address
    --to <address>          Recipient address
    --amount <number>       Amount in OCT
    --privateKey <key>      Private key for signing
    [--gasPrice <number>]   Gas price (default: 1)
    [--gasLimit <number>]   Gas limit (default: 21000)
  chain                     Show blockchain info

Examples:
  node transfer-dapp.js create-wallet
  node transfer-dapp.js balance --address 0x1234...
  node transfer-dapp.js mine --miner-address 0x1234...
  node transfer-dapp.js send --from 0xabc... --to 0xdef... --amount 10 --privateKey abc123...

Environment:
  DIGITAL_CHAIN_NODE         Node URL (default: http://localhost:3000)
`);
}

main();
