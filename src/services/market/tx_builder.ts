/**
 * Market 交易构建辅助函数
 *
 * **架构说明**：
 * - 提供托管、归属计划等交易的草稿构建函数
 * - 使用 Draft 模式构建交易
 */

import { IClient } from "../../client/client";
import { bytesToHex } from "../../utils/hex";
import { addressToHex, addressBytesToBase58 } from "../../utils/address";
import { queryUTXO, UTXO } from "../../utils/tx_utils";

/**
 * 选择足够的 UTXO（根据 tokenID 过滤）
 */
function selectUTXO(
  utxos: UTXO[],
  requiredAmount: bigint,
  tokenID: Uint8Array | null
): { selected: UTXO[]; totalAmount: bigint } | null {
  const tokenIDHex = tokenID ? bytesToHex(tokenID) : "";

  // 过滤匹配 tokenID 的 UTXO
  const matchingUTXOs = utxos.filter((utxo) => {
    if (!tokenID) {
      // 原生币：没有 tokenID 的 UTXO
      return !utxo.tokenID || utxo.tokenID === "";
    } else {
      // 合约代币：匹配相同 tokenID
      return utxo.tokenID && utxo.tokenID.toLowerCase() === tokenIDHex.toLowerCase();
    }
  });

  if (matchingUTXOs.length === 0) {
    return null;
  }

  // 选择足够的 UTXO（简化实现：选择第一个足够的 UTXO）
  for (const utxo of matchingUTXOs) {
    const amount = BigInt(utxo.amount);
    if (amount >= requiredAmount) {
      return {
        selected: [utxo],
        totalAmount: amount,
      };
    }
  }

  // 如果没有单个 UTXO 足够，尝试组合多个 UTXO
  const selected: UTXO[] = [];
  let totalAmount = BigInt(0);

  for (const utxo of matchingUTXOs) {
    selected.push(utxo);
    totalAmount += BigInt(utxo.amount);

    if (totalAmount >= requiredAmount) {
      return { selected, totalAmount };
    }
  }

  return null;
}

/**
 * 构建托管交易草稿
 *
 * **流程**：
 * 1. 查询买方 UTXO（根据 tokenID 过滤）
 * 2. 选择足够的 UTXO
 * 3. 构建交易草稿（包含 MultiKeyLock）
 *
 * **返回**：
 * - DraftJSON 字符串
 * - 输入索引（用于签名）
 */
export async function buildEscrowDraft(
  client: IClient,
  buyerAddress: Uint8Array,
  sellerAddress: Uint8Array,
  amount: bigint | number,
  tokenID: Uint8Array,
  expiry: bigint | number,
  escrowContractAddr?: Uint8Array // Escrow 合约地址（可选）
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (buyerAddress.length !== 20) {
    throw new Error("buyerAddress must be 20 bytes");
  }
  if (sellerAddress.length !== 20) {
    throw new Error("sellerAddress must be 20 bytes");
  }
  const amountNum = typeof amount === "bigint" ? Number(amount) : amount;
  if (amountNum <= 0) {
    throw new Error("amount must be greater than 0");
  }
  const expiryNum = typeof expiry === "bigint" ? Number(expiry) : expiry;
  if (expiryNum <= 0) {
    throw new Error("expiry time is required");
  }

  // 1. 将地址转换为 Base58 格式
  const buyerAddressBase58 = addressBytesToBase58(buyerAddress);

  // 2. 查询 UTXO
  const utxos = await queryUTXO(client, buyerAddressBase58);

  // 3. 选择足够的 UTXO（根据 tokenID 过滤）
  const selection = selectUTXO(utxos, BigInt(amountNum), tokenID);
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

  // 6. 构建锁定条件（MultiKeyLock 或 ContractLock + TimeLock）
  let lockingCondition: any;

  if (escrowContractAddr && escrowContractAddr.length > 0) {
    // ContractLock + TimeLock（过期后可以退款）
    lockingCondition = {
      type: "time_lock",
      unlock_timestamp: expiryNum.toString(),
      time_source: "TIME_SOURCE_BLOCK_TIMESTAMP",
      base_lock: {
        type: "contract_lock",
        contract_address: bytesToHex(escrowContractAddr),
      },
    };
  } else {
    // MultiKeyLock（买方和卖方都需要签名）
    lockingCondition = {
      type: "multi_key_lock",
      required_keys: [addressToHex(buyerAddress), addressToHex(sellerAddress)],
      threshold: 2, // 需要两个签名
    };
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
      caller_address: addressToHex(buyerAddress),
    },
  };

  // 8. 添加托管输出（带 MultiKeyLock）
  const escrowOutput: any = {
    type: "asset",
    owner: addressToHex(buyerAddress), // 托管给买方（但需要双方签名才能解锁）
    amount: amountNum.toString(),
    locking_condition: lockingCondition,
  };

  if (tokenID && tokenID.length > 0) {
    escrowOutput.token_id = bytesToHex(tokenID);
  }

  draft.outputs.push(escrowOutput);

  // 9. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    const changeOutput: any = {
      type: "asset",
      owner: addressToHex(buyerAddress),
      amount: changeAmount.toString(),
    };

    if (tokenID && tokenID.length > 0) {
      changeOutput.token_id = bytesToHex(tokenID);
    }

    draft.outputs.push(changeOutput);
  }

  // 10. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建释放托管交易草稿
 *
 * **流程**：
 * 1. 解析 EscrowID（outpoint 格式：txHash:index）
 * 2. 查询托管 UTXO
 * 3. 构建交易草稿（消费托管 UTXO，释放给卖方）
 */
export async function buildReleaseEscrowDraft(
  client: IClient,
  fromAddress: Uint8Array,
  sellerAddress: Uint8Array,
  escrowID: Uint8Array
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (sellerAddress.length !== 20) {
    throw new Error("sellerAddress must be 20 bytes");
  }
  if (escrowID.length === 0) {
    throw new Error("escrowID cannot be empty");
  }

  // 1. 解析 EscrowID（假设是 outpoint 格式：txHash:index）
  const escrowIDStr = new TextDecoder().decode(escrowID);
  const outpointParts = escrowIDStr.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid escrow ID format, expected txHash:index");
  }

  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 2. 查询托管 UTXO
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找对应的托管 UTXO
  const escrowUTXO = utxos.find((utxo) => utxo.outpoint === escrowIDStr);
  if (!escrowUTXO) {
    throw new Error(`Escrow UTXO not found: ${escrowIDStr}`);
  }

  // 4. 解析托管金额
  const escrowAmount = BigInt(escrowUTXO.amount);

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

  // 6. 添加释放托管输出（给卖方）
  const releaseOutput: any = {
    type: "asset",
    owner: addressToHex(sellerAddress),
    amount: escrowAmount.toString(),
  };

  if (escrowUTXO.tokenID) {
    releaseOutput.token_id = escrowUTXO.tokenID;
  }

  draft.outputs.push(releaseOutput);

  // 7. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建退款托管交易草稿
 *
 * **流程**：
 * 1. 解析 EscrowID（outpoint 格式：txHash:index）
 * 2. 查询托管 UTXO
 * 3. 构建交易草稿（消费托管 UTXO，退款给买方）
 */
export async function buildRefundEscrowDraft(
  client: IClient,
  fromAddress: Uint8Array,
  buyerAddress: Uint8Array,
  escrowID: Uint8Array
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (buyerAddress.length !== 20) {
    throw new Error("buyerAddress must be 20 bytes");
  }
  if (escrowID.length === 0) {
    throw new Error("escrowID cannot be empty");
  }

  // 1. 解析 EscrowID（假设是 outpoint 格式：txHash:index）
  const escrowIDStr = new TextDecoder().decode(escrowID);
  const outpointParts = escrowIDStr.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid escrow ID format, expected txHash:index");
  }

  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 2. 查询托管 UTXO
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找对应的托管 UTXO
  const escrowUTXO = utxos.find((utxo) => utxo.outpoint === escrowIDStr);
  if (!escrowUTXO) {
    throw new Error(`Escrow UTXO not found: ${escrowIDStr}`);
  }

  // 4. 解析托管金额
  const escrowAmount = BigInt(escrowUTXO.amount);

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

  // 6. 添加退款托管输出（给买方）
  const refundOutput: any = {
    type: "asset",
    owner: addressToHex(buyerAddress),
    amount: escrowAmount.toString(),
  };

  if (escrowUTXO.tokenID) {
    refundOutput.token_id = escrowUTXO.tokenID;
  }

  draft.outputs.push(refundOutput);

  // 7. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建归属计划交易草稿
 *
 * **流程**：
 * 1. 查询用户 UTXO（根据 tokenID 过滤）
 * 2. 选择足够的 UTXO
 * 3. 构建交易草稿（包含 TimeLock + SingleKeyLock/ContractLock）
 *
 * **返回**：
 * - DraftJSON 字符串
 * - 输入索引（用于签名）
 */
export async function buildVestingDraft(
  client: IClient,
  fromAddress: Uint8Array,
  toAddress: Uint8Array,
  amount: bigint | number,
  tokenID: Uint8Array,
  startTime: bigint | number,
  duration: bigint | number,
  vestingContractAddr?: Uint8Array // Vesting 合约地址（可选）
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (toAddress.length !== 20) {
    throw new Error("toAddress must be 20 bytes");
  }
  const amountNum = typeof amount === "bigint" ? Number(amount) : amount;
  if (amountNum <= 0) {
    throw new Error("amount must be greater than 0");
  }
  const durationNum = typeof duration === "bigint" ? Number(duration) : duration;
  if (durationNum <= 0) {
    throw new Error("duration must be greater than 0");
  }

  // 1. 将地址转换为 Base58 格式
  const fromAddressBase58 = addressBytesToBase58(fromAddress);

  // 2. 查询 UTXO
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 选择足够的 UTXO（根据 tokenID 过滤）
  const selection = selectUTXO(utxos, BigInt(amountNum), tokenID);
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

  // 6. 计算解锁时间戳
  const startTimeNum = typeof startTime === "bigint" ? Number(startTime) : startTime;
  const unlockTimestamp = startTimeNum + durationNum;

  // 7. 构建 TimeLock 锁定条件
  let lockingCondition: any;

  if (vestingContractAddr && vestingContractAddr.length > 0) {
    // TimeLock + ContractLock 组合
    lockingCondition = {
      type: "time_lock",
      unlock_timestamp: unlockTimestamp.toString(),
      time_source: "TIME_SOURCE_BLOCK_TIMESTAMP",
      base_lock: {
        type: "contract_lock",
        contract_address: bytesToHex(vestingContractAddr),
      },
    };
  } else {
    // TimeLock + SingleKeyLock
    lockingCondition = {
      type: "time_lock",
      unlock_timestamp: unlockTimestamp.toString(),
      time_source: "TIME_SOURCE_BLOCK_TIMESTAMP",
      base_lock: {
        type: "single_key_lock",
        required_address: addressToHex(toAddress),
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

  // 9. 添加归属计划输出（给受益人，带 TimeLock）
  const vestingOutput: any = {
    type: "asset",
    owner: addressToHex(toAddress),
    amount: amountNum.toString(),
    locking_condition: lockingCondition,
  };

  if (tokenID && tokenID.length > 0) {
    vestingOutput.token_id = bytesToHex(tokenID);
  }

  draft.outputs.push(vestingOutput);

  // 10. 添加找零输出（如果有剩余）
  if (changeAmount > BigInt(0)) {
    const changeOutput: any = {
      type: "asset",
      owner: addressToHex(fromAddress),
      amount: changeAmount.toString(),
    };

    if (tokenID && tokenID.length > 0) {
      changeOutput.token_id = bytesToHex(tokenID);
    }

    draft.outputs.push(changeOutput);
  }

  // 11. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}

/**
 * 构建领取归属代币交易草稿
 *
 * **流程**：
 * 1. 解析 VestingID（outpoint 格式：txHash:index）
 * 2. 查询归属 UTXO
 * 3. 构建交易草稿（消费归属 UTXO，返回给受益人）
 */
export async function buildClaimVestingDraft(
  client: IClient,
  fromAddress: Uint8Array,
  vestingID: Uint8Array
): Promise<{ draft: string; inputIndex: number }> {
  // 0. 参数验证
  if (fromAddress.length !== 20) {
    throw new Error("fromAddress must be 20 bytes");
  }
  if (vestingID.length === 0) {
    throw new Error("vestingID cannot be empty");
  }

  // 1. 解析 VestingID（outpoint 格式：txHash:index）
  const vestingIDStr = new TextDecoder().decode(vestingID);
  const outpointParts = vestingIDStr.split(":");
  if (outpointParts.length !== 2) {
    throw new Error("Invalid vesting ID format, expected txHash:index");
  }

  const txHash = outpointParts[0];
  const outputIndex = parseInt(outpointParts[1], 10);
  if (isNaN(outputIndex)) {
    throw new Error("Invalid output index");
  }

  const inputIndex = 0; // 只有一个输入，索引为0

  // 2. 查询归属 UTXO
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxos = await queryUTXO(client, fromAddressBase58);

  // 3. 查找对应的归属 UTXO
  const vestingUTXO = utxos.find((utxo) => utxo.outpoint === vestingIDStr);
  if (!vestingUTXO) {
    throw new Error(`Vesting UTXO not found: ${vestingIDStr}`);
  }

  // 4. 解析归属金额
  const vestingAmount = BigInt(vestingUTXO.amount);

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

  // 6. 添加领取归属代币输出（返回给受益人）
  const claimOutput: any = {
    type: "asset",
    owner: addressToHex(fromAddress),
    amount: vestingAmount.toString(),
  };

  if (vestingUTXO.tokenID) {
    claimOutput.token_id = vestingUTXO.tokenID;
  }

  draft.outputs.push(claimOutput);

  // 7. 序列化交易草稿为 JSON
  const draftJSON = JSON.stringify(draft);

  return { draft: draftJSON, inputIndex };
}
