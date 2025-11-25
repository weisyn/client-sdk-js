/**
 * Staking 交易构建辅助函数
 *
 * **架构说明**：
 * - 提供质押、解质押、委托等交易的草稿构建函数
 * - 使用 Draft 模式构建交易
 */

import { IClient } from "../../client/client";
import { bytesToHex } from "../../utils/hex";
import { addressToHex, addressBytesToBase58 } from "../../utils/address";
import { queryUTXO, selectNativeCoinUTXO, getCurrentBlockHeight, UTXO } from "../../utils/tx_utils";

/**
 * 构建质押交易草稿
 *
 * **流程**：
 * 1. 查询发送方的 UTXO（原生币）
 * 2. 选择足够的 UTXO
 * 3. 构建交易草稿（包含 HeightLock）
 *
 * **返回**：
 * - DraftJSON 字符串
 * - 输入索引（用于签名）
 */
export async function buildStakeDraft(
  client: IClient,
  fromAddress: Uint8Array,
  validatorAddr: Uint8Array,
  amount: bigint,
  lockBlocks: bigint | number,
  stakingContractAddr?: Uint8Array // Staking 合约地址（可选）
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (validatorAddr.length !== 20) {
    throw new Error("validatorAddr must be 20 bytes");
  }
  const amountNum = typeof amount === "bigint" ? Number(amount) : amount;
  if (amountNum <= 0) {
    throw new Error("amount must be greater than 0");
  }
  const lockBlocksNum = typeof lockBlocks === "bigint" ? Number(lockBlocks) : lockBlocks;
  if (lockBlocksNum <= 0) {
    throw new Error("lockBlocks must be greater than 0");
  }

  // 1. 将地址转换为 Base58 格式
  const fromAddressBase58 = addressBytesToBase58(fromAddress);

  // 2. 查询 UTXO
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 选择足够的原生币 UTXO
  const selection = selectNativeCoinUTXO(utxos, BigInt(amountNum));
  if (!selection) {
    throw new Error(`Insufficient balance: required ${amountNum}, but no UTXO found`);
  }

  const selectedUTXO = selection.selected[0]; // 简化：只使用第一个 UTXO
  const selectedAmount = selection.totalAmount;

  // 4. 解析 outpoint
  const outpointParts = selectedUTXO.outpoint.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid outpoint format");
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 计算找零
  const changeAmount = selectedAmount - BigInt(amountNum);

  // 6. 获取当前区块高度（用于计算解锁高度）
  const currentHeight = await getCurrentBlockHeight(client);

  // 计算解锁高度
  let unlockHeightStr: string;
  if (currentHeight > 0) {
    const unlockHeight = currentHeight + lockBlocksNum;
    unlockHeightStr = unlockHeight.toString();
  } else {
    // 使用相对高度（节点会在构建交易时转换为绝对高度）
    unlockHeightStr = lockBlocksNum.toString();
  }

  // 7. 构建锁定条件（HeightLock + ContractLock 或 SingleKeyLock）
  let lockingCondition: any;

  if (stakingContractAddr && stakingContractAddr.length > 0) {
    // HeightLock + ContractLock 组合
    lockingCondition = {
      type: "height_lock",
      unlock_height: unlockHeightStr,
      base_lock: {
        type: "contract_lock",
        contract_address: bytesToHex(stakingContractAddr),
      },
    };
  } else {
    // 只使用 HeightLock + SingleKeyLock
    lockingCondition = {
      type: "height_lock",
      unlock_height: unlockHeightStr,
      base_lock: {
        type: "single_key_lock",
        required_address: addressToHex(validatorAddr),
      },
    };
  }

  // 8. 构建交易草稿
  const draft: any = {
    sign_mode: "defer_sign",
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(fromAddress),
    },
  };

  // 9. 添加质押输出（给验证者，带锁定条件）
  draft.outputs.push({
    type: "asset",
    owner: addressToHex(validatorAddr),
    amount: amountNum.toString(),
    locking_condition: lockingCondition,
  });

  // 10. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    draft.outputs.push({
      type: "asset",
      owner: addressToHex(fromAddress),
      amount: changeAmount.toString(),
    });
  }

  // 11. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建解质押交易草稿
 *
 * **流程**：
 * 1. 解析 StakeID（outpoint 格式：txHash:index）
 * 2. 查询质押 UTXO
 * 3. 构建交易草稿（消费质押 UTXO，返回给用户）
 */
export async function buildUnstakeDraft(
  client: IClient,
  fromAddress: Uint8Array,
  stakeID: Uint8Array,
  amount: bigint | number
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (stakeID.length === 0) {
    throw new Error("stakeID cannot be empty");
  }

  // 1. 解析 StakeID（假设是 outpoint 格式：txHash:index）
  const stakeIDStr = new TextDecoder().decode(stakeID);
  const outpointParts = stakeIDStr.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid stake ID format, expected txHash:index");
  }

  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 2. 查询质押 UTXO
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找对应的质押 UTXO
  const stakeUTXO = utxos.find((utxo) => utxo.outpoint === stakeIDStr);
  if (!stakeUTXO) {
    throw new Error(`Stake UTXO not found: ${stakeIDStr}`);
  }

  // 4. 解析质押金额
  const stakeAmount = BigInt(stakeUTXO.amount);

  // 5. 计算解质押金额
  const amountNum = typeof amount === "bigint" ? amount : BigInt(amount);
  let unstakeAmount = amountNum;
  if (amountNum === BigInt(0) || unstakeAmount > stakeAmount) {
    unstakeAmount = stakeAmount; // 全部解质押
  }

  // 6. 计算找零
  const changeAmount = stakeAmount - unstakeAmount;

  // 7. 构建交易草稿
  const draft: any = {
    sign_mode: "defer_sign",
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(fromAddress),
    },
  };

  // 8. 添加解质押输出（返回给用户）
  draft.outputs.push({
    type: "asset",
    owner: addressToHex(fromAddress),
    amount: unstakeAmount.toString(),
  });

  // 9. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    draft.outputs.push({
      type: "asset",
      owner: addressToHex(fromAddress),
      amount: changeAmount.toString(),
    });
  }

  // 10. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建委托交易草稿
 *
 * **流程**：
 * 1. 查询用户 UTXO（原生币）
 * 2. 选择足够的 UTXO
 * 3. 构建交易草稿（包含 DelegationLock）
 *
 * **返回**：
 * - DraftJSON 字符串
 * - 输入索引（用于签名）
 */
export async function buildDelegateDraft(
  client: IClient,
  fromAddress: Uint8Array,
  validatorAddr: Uint8Array,
  amount: bigint,
  expiryDurationBlocks: bigint | number = BigInt(0), // 委托有效期（区块数，0=永不过期）
  maxValuePerOperation: bigint | number // 单次操作最大价值
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (validatorAddr.length !== 20) {
    throw new Error("validatorAddr must be 20 bytes");
  }
  const amountNum = typeof amount === "bigint" ? Number(amount) : amount;
  if (amountNum <= 0) {
    throw new Error("amount must be greater than 0");
  }
  const expiryBlocksNum =
    typeof expiryDurationBlocks === "bigint" ? Number(expiryDurationBlocks) : expiryDurationBlocks;
  const maxValueNum =
    typeof maxValuePerOperation === "bigint" ? Number(maxValuePerOperation) : maxValuePerOperation;

  // 1. 将地址转换为 Base58 格式
  const fromAddressBase58 = addressBytesToBase58(fromAddress);

  // 2. 查询 UTXO
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 选择足够的原生币 UTXO
  const selection = selectNativeCoinUTXO(utxos, BigInt(amountNum));
  if (!selection) {
    throw new Error(`Insufficient balance: required ${amountNum}, but no UTXO found`);
  }

  const selectedUTXO = selection.selected[0]; // 简化：只使用第一个 UTXO
  const selectedAmount = selection.totalAmount;

  // 4. 解析 outpoint
  const outpointParts = selectedUTXO.outpoint.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid outpoint format");
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 计算找零
  const changeAmount = selectedAmount - BigInt(amountNum);

  // 6. 构建 DelegationLock 锁定条件
  const delegationLock: any = {
    type: "delegation_lock",
    original_owner: addressToHex(fromAddress),
    allowed_delegates: [addressToHex(validatorAddr)],
    authorized_operations: ["stake", "consume"],
    max_value_per_operation: maxValueNum.toString(),
  };

  if (expiryBlocksNum > 0) {
    delegationLock.expiry_duration_blocks = expiryBlocksNum.toString();
  }

  // 7. 构建交易草稿
  const draft: any = {
    sign_mode: "defer_sign",
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(fromAddress),
    },
  };

  // 8. 添加委托输出（给验证者，带 DelegationLock）
  draft.outputs.push({
    type: "asset",
    owner: addressToHex(validatorAddr),
    amount: amountNum.toString(),
    locking_condition: delegationLock,
  });

  // 9. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    draft.outputs.push({
      type: "asset",
      owner: addressToHex(fromAddress),
      amount: changeAmount.toString(),
    });
  }

  // 10. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建取消委托交易草稿
 *
 * **流程**：
 * 1. 解析 DelegateID（outpoint 格式：txHash:index）
 * 2. 查询委托 UTXO
 * 3. 构建交易草稿（消费委托 UTXO，返回给用户）
 */
export async function buildUndelegateDraft(
  client: IClient,
  fromAddress: Uint8Array,
  delegateID: Uint8Array,
  amount: bigint | number
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (delegateID.length === 0) {
    throw new Error("delegateID cannot be empty");
  }

  // 1. 解析 DelegateID（假设是 outpoint 格式：txHash:index）
  const delegateIDStr = new TextDecoder().decode(delegateID);
  const outpointParts = delegateIDStr.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid delegate ID format, expected txHash:index");
  }

  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 2. 查询委托 UTXO
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找对应的委托 UTXO
  const delegateUTXO = utxos.find((utxo) => utxo.outpoint === delegateIDStr);
  if (!delegateUTXO) {
    throw new Error(`Delegate UTXO not found: ${delegateIDStr}`);
  }

  // 4. 解析委托金额
  const delegateAmount = BigInt(delegateUTXO.amount);

  // 5. 计算取消委托金额
  const amountNum = typeof amount === "bigint" ? amount : BigInt(amount);
  let undelegateAmount = amountNum;
  if (amountNum === BigInt(0) || undelegateAmount > delegateAmount) {
    undelegateAmount = delegateAmount; // 全部取消委托
  }

  // 6. 计算找零
  const changeAmount = delegateAmount - undelegateAmount;

  // 7. 构建交易草稿
  const draft: any = {
    sign_mode: "defer_sign",
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(fromAddress),
    },
  };

  // 8. 添加取消委托输出（返回给用户）
  draft.outputs.push({
    type: "asset",
    owner: addressToHex(fromAddress),
    amount: undelegateAmount.toString(),
  });

  // 9. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    draft.outputs.push({
      type: "asset",
      owner: addressToHex(fromAddress),
      amount: changeAmount.toString(),
    });
  }

  // 10. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建领取奖励交易草稿
 *
 * **流程**：
 * 1. 查询奖励 UTXO（通过 StakeID 或 DelegateID，或查询用户的 UTXO 列表）
 * 2. 构建交易草稿（消费奖励 UTXO，返回给用户）
 *
 * **注意**：
 * - 奖励 UTXO 可能由合约产生，需要通过合约调用或状态查询获取
 * - 当前实现假设奖励 UTXO 可以通过查询用户的 UTXO 列表找到
 */
export async function buildClaimRewardDraft(
  client: IClient,
  fromAddress: Uint8Array,
  stakeID?: Uint8Array,
  delegateID?: Uint8Array
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if ((!stakeID || stakeID.length === 0) && (!delegateID || delegateID.length === 0)) {
    throw new Error("Either stakeID or delegateID is required");
  }

  // 1. 将地址转换为 Base58 格式
  const fromAddressBase58 = addressBytesToBase58(fromAddress);

  // 2. 查询用户的 UTXO 列表
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找奖励 UTXO
  // 奖励 UTXO 的特征：
  // - owner = 用户地址
  // - 可能是由 Staking 合约产生的
  // - 或者通过 StakeID/DelegateID 关联查询
  let rewardUTXO: UTXO | undefined;
  let rewardAmount = BigInt(0);

  // 优先通过 StakeID 或 DelegateID 查找
  let targetOutpoint = "";
  if (stakeID && stakeID.length > 0) {
    targetOutpoint = new TextDecoder().decode(stakeID);
  } else if (delegateID && delegateID.length > 0) {
    targetOutpoint = new TextDecoder().decode(delegateID);
  }

  // 查找对应的奖励 UTXO
  for (const utxo of utxos) {
    // 如果提供了 StakeID 或 DelegateID，尝试通过关联查找
    // 这里简化处理：查找金额大于 0 的原生币 UTXO（可能是奖励）
    if (targetOutpoint !== "") {
      const amount = BigInt(utxo.amount);
      if (amount > BigInt(0) && (!utxo.tokenID || utxo.tokenID === "")) {
        // 原生币，可能是奖励
        rewardUTXO = utxo;
        rewardAmount = amount;
        break;
      }
    } else {
      // 如果没有提供 ID，查找所有可能的奖励 UTXO（简化：选择第一个金额大于 0 的原生币 UTXO）
      const amount = BigInt(utxo.amount);
      if (amount > BigInt(0) && (!utxo.tokenID || utxo.tokenID === "")) {
        if (!rewardUTXO) {
          rewardUTXO = utxo;
          rewardAmount = amount;
        }
      }
    }
  }

  if (!rewardUTXO) {
    throw new Error("Reward UTXO not found (may need contract call or state query)");
  }

  // 4. 解析 outpoint
  const outpointParts = rewardUTXO.outpoint.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid outpoint format");
  }
  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 5. 构建交易草稿
  const draft: any = {
    sign_mode: "defer_sign",
    inputs: [
      {
        tx_hash: txHash,
        output_index: outputIndex,
        is_reference_only: false,
      },
    ],
    outputs: [],
    metadata: {
      caller_address: addressToHex(fromAddress),
    },
  };

  // 6. 添加领取奖励输出（返回给用户）
  draft.outputs.push({
    type: "asset",
    owner: addressToHex(fromAddress),
    amount: rewardAmount.toString(),
  });

  // 7. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}
