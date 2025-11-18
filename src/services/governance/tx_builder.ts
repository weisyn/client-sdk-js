/**
 * Governance 交易构建辅助函数
 * 
 * **架构说明**：
 * - 提供提案、投票等交易的草稿构建函数
 * - 使用 Draft 模式构建交易
 */

import { IClient } from '../../client/client';
import { bytesToHex } from '../../utils/hex';
import { addressToHex, addressBytesToBase58 } from '../../utils/address';
import {
  queryUTXO,
} from '../../utils/tx_utils';

/**
 * 构建提案交易草稿
 * 
 * **流程**：
 * 1. 查询提案者 UTXO（用于支付手续费）
 * 2. 选择第一个原生币 UTXO
 * 3. 构建交易草稿（包含 StateOutput）
 * 
 * **返回**：
 * - DraftJSON 字符串
 * - 输入索引（用于签名）
 */
export async function buildProposeDraft(
  client: IClient,
  proposerAddress: Uint8Array,
  title: string,
  description: string,
  votingPeriod: bigint | number,
  validatorAddresses: Uint8Array[], // 验证者地址列表（用于 ThresholdLock）
  threshold: number // 门限值（需要多少个签名）
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (proposerAddress.length !== 20) {
    throw new Error('proposerAddress must be 20 bytes');
  }
  if (!title || title.trim() === '') {
    throw new Error('title cannot be empty');
  }
  const votingPeriodNum = typeof votingPeriod === 'bigint' ? Number(votingPeriod) : votingPeriod;
  if (votingPeriodNum <= 0) {
    throw new Error('votingPeriod must be greater than 0');
  }
  if (validatorAddresses.length === 0) {
    throw new Error('validatorAddresses cannot be empty');
  }
  if (threshold <= 0) {
    throw new Error('threshold must be greater than 0');
  }

  // 1. 将地址转换为 Base58 格式
  const proposerAddressBase58 = addressBytesToBase58(proposerAddress);

  // 2. 查询 UTXO（用于支付手续费）
  const utxos = await queryUTXO(client, proposerAddressBase58);

  // 3. 选择第一个可用 UTXO（用于支付手续费）
  const selectedUTXO = utxos.find((utxo) => !utxo.tokenID || utxo.tokenID === '');
  if (!selectedUTXO) {
    throw new Error('No available native coin UTXO for fee');
  }

  // 4. 解析 outpoint
  const outpointParts = selectedUTXO.outpoint.split(':');
  if (outpointParts.length !== 2) {
    throw new Error('Invalid outpoint format');
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error('Invalid output index');
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 构建提案数据（存储在 StateOutput 中）
  const proposalData = {
    type: 'proposal',
    title,
    description,
    voting_period: votingPeriodNum,
    proposer: addressToHex(proposerAddress),
  };
  const proposalDataJSON = JSON.stringify(proposalData);

  // 6. 为 StateOutput 构建元数据（满足节点端 state 输出要求）
  // 根据提案数据生成一个 deterministic 的 state_id（仅用于测试与追踪）
  const crypto = require('crypto');
  const stateHash = crypto.createHash('sha256').update(proposalDataJSON).digest();
  const stateIDHex = bytesToHex(stateHash);

  const stateMetadata = {
    state_id: stateIDHex,
    state_version: 1,
    // 其他字段（execution_result_hash / public_inputs 等）可以留空，由节点使用默认值
  };

  // 7. 构建交易草稿（DraftJSON）
  const draft: any = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(proposerAddress),
    },
  };

  // 8. 添加提案 StateOutput
  const proposalOutput: any = {
    type: 'state',
    owner: addressToHex(proposerAddress),
    amount: '0', // 状态输出本身不携带资产金额
    token_id: '', // 状态输出不关联 token
    metadata: stateMetadata,
    // 提案内容仍然保留在 data 字段，便于后续扩展或调试
    data: proposalDataJSON,
  };
  
  draft.outputs.push(proposalOutput);

  // 9. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建投票交易草稿
 * 
 * **流程**：
 * 1. 查询投票者 UTXO（用于支付手续费）
 * 2. 选择第一个原生币 UTXO
 * 3. 构建交易草稿（包含 StateOutput + SingleKeyLock）
 */
export async function buildVoteDraft(
  client: IClient,
  voterAddress: Uint8Array,
  proposalID: Uint8Array,
  choice: number, // 1=支持, 0=反对, -1=弃权
  voteWeight: bigint | number
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (voterAddress.length !== 20) {
    throw new Error('voterAddress must be 20 bytes');
  }
  if (proposalID.length === 0) {
    throw new Error('proposalID cannot be empty');
  }
  if (choice < -1 || choice > 1) {
    throw new Error('choice must be -1 (abstain), 0 (against), or 1 (for)');
  }
  const voteWeightNum = typeof voteWeight === 'bigint' ? Number(voteWeight) : voteWeight;
  if (voteWeightNum <= 0) {
    throw new Error('voteWeight must be greater than 0');
  }

  // 1. 将地址转换为 Base58 格式
  const voterAddressBase58 = addressBytesToBase58(voterAddress);

  // 2. 查询 UTXO（用于支付手续费）
  const utxos = await queryUTXO(client, voterAddressBase58);

  // 3. 选择第一个可用 UTXO（用于支付手续费）
  const selectedUTXO = utxos.find((utxo) => !utxo.tokenID || utxo.tokenID === '');
  if (!selectedUTXO) {
    throw new Error('No available native coin UTXO for fee');
  }

  // 4. 解析 outpoint
  const outpointParts = selectedUTXO.outpoint.split(':');
  if (outpointParts.length !== 2) {
    throw new Error('Invalid outpoint format');
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error('Invalid output index');
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 解析提案ID（假设是 outpoint 格式：txHash:index 或 hex 字符串）
  const proposalIDStr = new TextDecoder().decode(proposalID);

  // 6. 构建投票数据（存储在 StateOutput 中）
  const voteData = {
    type: 'vote',
    proposal_id: proposalIDStr,
    choice,
    vote_weight: voteWeightNum,
    voter: addressToHex(voterAddress),
  };
  const voteDataJSON = JSON.stringify(voteData);

  // 7. 为 StateOutput 构建元数据
  const crypto = require('crypto');
  const stateHash = crypto.createHash('sha256').update(voteDataJSON).digest();
  const stateIDHex = bytesToHex(stateHash);

  const stateMetadata = {
    state_id: stateIDHex,
    state_version: 1,
  };

  // 8. 构建交易草稿
  const draft: any = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(voterAddress),
    },
  };

  // 9. 添加投票 StateOutput（带 SingleKeyLock）
  const voteOutput: any = {
    type: 'state',
    owner: addressToHex(voterAddress),
    amount: '0',
    token_id: '',
    metadata: stateMetadata,
    data: voteDataJSON,
  };
  
  draft.outputs.push(voteOutput);

  // 10. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建更新参数交易草稿
 * 
 * **流程**：
 * 1. 查询提案者 UTXO（用于支付手续费）
 * 2. 选择第一个原生币 UTXO
 * 3. 构建交易草稿（包含 StateOutput）
 */
export async function buildUpdateParamDraft(
  client: IClient,
  proposerAddress: Uint8Array,
  paramKey: string,
  paramValue: string,
  validatorAddresses: Uint8Array[], // 验证者地址列表（用于 ThresholdLock）
  threshold: number // 门限值（需要多少个签名）
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (proposerAddress.length !== 20) {
    throw new Error('proposerAddress must be 20 bytes');
  }
  if (!paramKey || paramKey.trim() === '') {
    throw new Error('paramKey cannot be empty');
  }
  if (!paramValue || paramValue.trim() === '') {
    throw new Error('paramValue cannot be empty');
  }
  if (validatorAddresses.length === 0) {
    throw new Error('validatorAddresses cannot be empty');
  }
  if (threshold <= 0) {
    throw new Error('threshold must be greater than 0');
  }

  // 1. 将地址转换为 Base58 格式
  const proposerAddressBase58 = addressBytesToBase58(proposerAddress);

  // 2. 查询 UTXO（用于支付手续费）
  const utxos = await queryUTXO(client, proposerAddressBase58);

  // 3. 选择第一个可用 UTXO（用于支付手续费）
  const selectedUTXO = utxos.find((utxo) => !utxo.tokenID || utxo.tokenID === '');
  if (!selectedUTXO) {
    throw new Error('No available native coin UTXO for fee');
  }

  // 4. 解析 outpoint
  const outpointParts = selectedUTXO.outpoint.split(':');
  if (outpointParts.length !== 2) {
    throw new Error('Invalid outpoint format');
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error('Invalid output index');
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 构建参数更新数据（存储在 StateOutput 中）
  const paramData = {
    type: 'param_update',
    param_key: paramKey,
    param_value: paramValue,
    proposer: addressToHex(proposerAddress),
  };
  const paramDataJSON = JSON.stringify(paramData);

  // 6. 为 StateOutput 构建元数据
  const crypto = require('crypto');
  const stateHash = crypto.createHash('sha256').update(paramDataJSON).digest();
  const stateIDHex = bytesToHex(stateHash);

  const stateMetadata = {
    state_id: stateIDHex,
    state_version: 1,
  };

  // 7. 构建交易草稿
  const draft: any = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(proposerAddress),
    },
  };

  // 8. 添加参数更新 StateOutput
  const paramOutput: any = {
    type: 'state',
    owner: addressToHex(proposerAddress),
    amount: '0',
    token_id: '',
    metadata: stateMetadata,
    data: paramDataJSON,
  };
  
  draft.outputs.push(paramOutput);

  // 9. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

