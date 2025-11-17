/**
 * Slash 方法示例实现
 * 
 * **说明**：
 * 这是一个示例实现，展示如何通过治理合约来实现 Slash 功能。
 * 实际使用时，需要根据链上部署的具体合约进行调整。
 * 
 * **使用方式**：
 * 1. 如果链上部署了 Slash 合约，可以直接调用合约方法
 * 2. 如果通过治理系统实现，可以通过 Governance Service 创建 Slash 提案
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex } from '../../utils/hex';
import { SlashRequest, SlashResult } from './types';

/**
 * 通过 Slash 合约实现罚没（示例）
 * 
 * **前提条件**：
 * - 链上已部署 Slash 合约
 * - 合约地址已知
 * 
 * **流程**：
 * 1. 构建 Slash 方法参数
 * 2. 调用 `wes_callContract` API
 * 3. 签名并提交交易
 */
export async function slashViaContract(
  client: IClient,
  request: SlashRequest,
  slashContractAddr: Uint8Array,
  wallet: Wallet
): Promise<SlashResult> {
  // 1. 参数验证
  if (request.validatorAddr.length !== 20) {
    throw new Error('Validator address must be 20 bytes');
  }

  const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
  if (amount <= BigInt(0)) {
    throw new Error('Amount must be greater than 0');
  }

  if (!request.reason || request.reason.trim() === '') {
    throw new Error('Reason is required');
  }

  // 2. 构建 Slash 方法参数
  const slashParams = {
    validator_addr: bytesToHex(request.validatorAddr),
    amount: amount.toString(),
    reason: request.reason,
  };

  const payloadJSON = JSON.stringify(slashParams);
  const payloadBase64 = Buffer.from(payloadJSON).toString('base64');

  // 3. 调用 `wes_callContract` API
  const callContractParams = {
    content_hash: bytesToHex(slashContractAddr),
    method: 'slash',
    params: [],
    payload: payloadBase64,
    return_unsigned_tx: true,
  };

  const result = await client.call('wes_callContract', [callContractParams]);

  if (!result || typeof result !== 'object') {
    throw new Error('Invalid response format from wes_callContract');
  }

  const resultMap = result as any;
  const unsignedTxHex = resultMap.unsigned_tx || resultMap.unsignedTx;

  if (!unsignedTxHex) {
    throw new Error('Missing unsigned_tx in response');
  }

  // 4. 签名交易
  const unsignedTx = Buffer.from(unsignedTxHex, 'hex');
  const signature = await wallet.signTransaction(unsignedTx);

  // 5. 完成交易
  const { finalizeTransactionFromDraft } = await import('../../utils/tx_utils');
  const signedTx = await finalizeTransactionFromDraft(
    client,
    unsignedTxHex,
    [signature]
  );

  // 6. 提交交易
  const sendResult = await client.call('wes_sendRawTransaction', [signedTx]);

  if (!sendResult || typeof sendResult !== 'object') {
    throw new Error('Invalid response format from wes_sendRawTransaction');
  }

  const sendResultMap = sendResult as any;
  const txHash = sendResultMap.tx_hash || sendResultMap.txHash;

  if (!txHash) {
    throw new Error('Missing tx_hash in response');
  }

  return {
    txHash,
    success: true,
    blockHeight: undefined,
  };
}

/**
 * 通过治理提案实现罚没（示例）
 * 
 * **前提条件**：
 * - Governance Service 已配置
 * - 治理合约支持 Slash 提案
 * 
 * **流程**：
 * 1. 创建 Slash 提案
 * 2. 等待投票
 * 3. 执行提案（自动执行 Slash）
 */
export async function slashViaGovernance(
  governanceService: any, // GovernanceService 类型
  request: SlashRequest,
  proposerWallet: Wallet,
  votingPeriod: bigint | number
): Promise<SlashResult> {
  // 1. 构建提案内容
  const proposalTitle = `Slash Validator: ${bytesToHex(request.validatorAddr)}`;
  const proposalDescription = `
    Slash Request:
    - Validator: ${bytesToHex(request.validatorAddr)}
    - Amount: ${typeof request.amount === 'bigint' ? request.amount.toString() : request.amount}
    - Reason: ${request.reason}
  `;

  // 2. 创建治理提案
  const proposeResult = await governanceService.propose(
    {
      proposer: proposerWallet.address,
      title: proposalTitle,
      description: proposalDescription,
      votingPeriod: typeof votingPeriod === 'bigint' ? votingPeriod : BigInt(votingPeriod),
    },
    proposerWallet
  );

  if (!proposeResult.success) {
    throw new Error(`Failed to create slash proposal: ${proposeResult.txHash}`);
  }

  // 3. 返回提案结果
  // 注意：实际的 Slash 执行会在提案通过后自动执行
  return {
    txHash: proposeResult.txHash,
    success: true,
    blockHeight: proposeResult.blockHeight,
  };
}

