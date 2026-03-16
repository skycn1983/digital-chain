#!/usr/bin/env node

/**
 * Digital Chain 投票 DApp
 * 基于链上交易的去中心化投票系统
 */

const { DigitalChainClient } = require('../../sdk');
const readline = require('readline');

const VOTING_SYSTEM_ADDRESS = '0x564f494e475f434f4e5452414354'; // "VOTING_CONTRACT"
const PROPOSAL_PREFIX = 'proposal:';

const DEFAULT_NODE = process.env.DIGITAL_CHAIN_NODE || 'http://localhost:3000';

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
      case 'create-proposal':
        await createProposal(client, args);
        break;
      case 'vote':
        await vote(client, args);
        break;
      case 'get-proposal':
        await getProposal(client, args);
        break;
      case 'list-proposals':
        await listProposals(client);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.response) {
      console.error('   Details:', error.response.data || error.response);
    }
    process.exit(1);
  }
}

async function createProposal(client, args) {
  const title = extractArg(args, '--title');
  const description = extractArg(args, '--description');
  const duration = parseInt(extractArg(args, '--duration')) || 86400; // 默认1天
  const creator = extractArg(args, '--creator');
  const privateKey = extractArg(args, '--privateKey');

  if (!title || !creator || !privateKey) {
    console.error('❌ Missing required: --title, --creator, --privateKey');
    process.exit(1);
  }

  // 1. 获取当前链高度，计算截止区块（假设每块 ~2秒）
  const info = await client.getChainInfo();
  const blocksPerSecond = 0.5; // 保守估计
  const durationBlocks = Math.floor(duration / 2); // 每块2秒
  const endBlock = info.blocks.length + durationBlocks;

  // 2. 创建提案元数据（临时存储，后续通过事件查找）
  const proposalId = PROPOSAL_PREFIX + Date.now() + ':' + creator;

  // 3. 发送创建提案交易（特殊交易到系统地址）
  // 使用 data 字段存储提案信息（这里简化为 title, description, endBlock）
  // 注意：实际 Transaction 类可能不支持自定义 data，需要扩展。
  // 本示例使用 memo 字段或自定义序列化。
  // 但 SDK 的 Transaction 只支持 from/to/amount/gas等。
  // 所以我们需要用特殊方式：发送 0 金额交易，并在 signature 或 memo 中编码提案数据。
  // 暂时方案：发送 0 OCT 到系统地址，nonce 用来区分，后续通过扫描链上交易解析。

  console.log(`📝 Creating proposal: ${title}`);
  console.log(`   Description: ${description}`);
  console.log(`   Duration: ${duration} seconds (until block ~${endBlock})`);

  // 提案创建交易：from → VOTING_SYSTEM_ADDRESS, amount = 0
  const tx = await client.sendTransaction({
    from: creator,
    to: VOTING_SYSTEM_ADDRESS,
    amount: 0,
    gasPrice: 1,
    gasLimit: 50000,
    privateKey
  });

  console.log(`✅ Proposal created!`);
  console.log(`   Tx hash: ${tx.hash}`);
  console.log(`   Nonce: ${tx.nonce}`);
  console.log('');
  console.log('⏳ Waiting for confirmation...');
  await waitForConfirmation(client, tx.hash);

  // 提案地址即为交易 hash（作为唯一标识）
  console.log(`🎯 Proposal address (use for voting): ${tx.hash}`);
  console.log('');
  console.log('Save this address to allow others to vote.');
}

async function vote(client, args) {
  const proposal = extractArg(args, '--proposal');
  const choice = parseInt(extractArg(args, '--choice'));
  const voter = extractArg(args, '--voter');
  const privateKey = extractArg(args, '--privateKey');

  if (!proposal || choice === undefined || !voter || !privateKey) {
    console.error('❌ Missing required: --proposal, --choice (1 or 0), --voter, --privateKey');
    process.exit(1);
  }

  if (choice !== 0 && choice !== 1) {
    console.error('❌ Invalid choice. Use 1 for yes, 0 for no.');
    process.exit(1);
  }

  // 投票交易：发送 0 OCT 到提案地址，携带投票选择
  // 同样，需要编码 choice 到交易数据中。由于当前交易结构限制，
  // 我们使用 nonce 来编码（不推荐）或期待后续数据字段支持。
  // 本示例作为演示，仅发送交易到提案地址，实际投票数据需链下解析或修改协议。
  console.log(`🗳️  Voting on proposal ${proposal.substring(0, 12)}...`);
  console.log(`   Choice: ${choice === 1 ? '✅ Yes' : '❌ No'}`);

  const tx = await client.sendTransaction({
    from: voter,
    to: proposal,
    amount: 0,
    gasPrice: 1,
    gasLimit: 50000,
    privateKey
  });

  console.log(`✅ Vote submitted!`);
  console.log(`   Tx hash: ${tx.hash}`);
}

async function getProposal(client, args) {
  const proposal = extractArg(args, '--proposal');
  if (!proposal) {
    console.error('❌ Missing --proposal');
    process.exit(1);
  }

  // 扫描链，找到与该提案相关的所有交易
  console.log(`🔍 Scanning blockchain for proposal ${proposal.substring(0, 12)}...`);
  const chain = await client.getChainInfo();

  // 1. 找到创建提案的交易（from any to VOTING_SYSTEM_ADDRESS，且 hash == proposal?）
  // 提案地址就是创建交易的 hash
  const createTx = chain.blocks.flatMap(b => b.transactions).find(tx => tx.hash === proposal);
  if (!createTx) {
    console.error(`❌ Proposal not found: ${proposal}`);
    process.exit(1);
  }

  if (createTx.to !== VOTING_SYSTEM_ADDRESS) {
    console.error(`❌ Invalid proposal address (not from voting system)`);
    process.exit(1);
  }

  console.log(`📄 Proposal created in block #${createTx.blockIndex || '?'}`);
  console.log(`   Creator: ${createTx.from}`);
  console.log(`   Timestamp: ${new Date(createTx.timestamp).toLocaleString()}`);

  // 2. 收集投票交易（from any to proposal address）
  const votes = [];
  for (const block of chain.blocks) {
    for (const tx of block.transactions) {
      if (tx.to === proposal && tx.from !== VOTING_SYSTEM_ADDRESS) {
        votes.push({
          hash: tx.hash,
          voter: tx.from,
          block: block.index,
          timestamp: tx.timestamp
        });
      }
    }
  }

  console.log(`🗳️  Total votes: ${votes.length}`);
  // 注意：由于我们未编码投票选择到交易中，这里只能显示投票数量，无法知道是赞成还是反对。
  // 实际系统需要在交易数据中编码 choice。
  console.log('   (Vote choices not stored in current implementation)');

  // 显示最近的5个投票
  if (votes.length > 0) {
    console.log('   Recent votes:');
    votes.slice(-5).forEach(v => {
      console.log(`     - ${v.voter.substring(0, 12)}... (block ${v.block})`);
    });
  }
}

async function listProposals(client) {
  const chain = await client.getChainInfo();
  console.log('📋 Scanning all proposals...');

  // 提案交易：to === VOTING_SYSTEM_ADDRESS, amount === 0
  const proposalTxs = [];
  for (const block of chain.blocks) {
    for (const tx of block.transactions) {
      if (tx.to === VOTING_SYSTEM_ADDRESS && tx.amount === 0) {
        proposalTxs.push({ ...tx, blockIndex: block.index });
      }
    }
  }

  console.log(`Found ${proposalTxs.length} proposal(s):`);
  for (const p of proposalTxs) {
    console.log(`  📌 ${p.hash.substring(0, 16)}... (block ${p.blockIndex})`);
    console.log(`     Creator: ${p.from}`);
    console.log(`     Time: ${new Date(p.timestamp).toLocaleString()}`);
  }
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
🔹 Digital Chain Voting DApp

Usage:
  node voting-dapp.js <command> [options]

Commands:
  create-proposal            Create a new voting proposal
    --title <string>         Proposal title
    --description <string>   Description
    [--duration <seconds>]   Voting duration (default: 86400 = 1 day)
    --creator <address>      Creator address
    --privateKey <key>       Creator private key

  vote                       Vote on a proposal
    --proposal <address>     Proposal address (tx hash of creation)
    --choice <0|1>           0 = No, 1 = Yes
    --voter <address>        Voter address
    --privateKey <key>       Voter private key

  get-proposal               Get proposal details and votes
    --proposal <address>     Proposal address

  list-proposals             List all proposals on chain

Examples:
  node voting-dapp.js create-proposal --title "Test" --creator 0x... --privateKey ...
  node voting-dapp.js vote --proposal 0x... --choice 1 --voter 0x... --privateKey ...
  node voting-dapp.js get-proposal --proposal 0x...

Note: This is a simplified demo. Real implementation would store vote data in transaction payload.
`);
}

main();
