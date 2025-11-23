/**
 * 权限交易构建器
 * 
 * 实现权限变更操作的交易构建逻辑，遵循 EUTXO 模型：
 * - 消费旧的 Resource UTXO（TxInput, is_reference_only=false）
 * - 创建新的 Resource UTXO（TxOutput.resource, 新的 locking_conditions）
 */

import { IClient } from '../../client/client';
import { bytesToHex } from '../../utils/hex';
import { isValidAddress } from '../../utils/address';
import type {
  TransferOwnershipIntent,
  UpdateCollaboratorsIntent,
  GrantDelegationIntent,
  SetTimeOrHeightLockIntent,
  UnsignedTransaction,
} from './types';

/**
 * 构建所有权转移交易
 * 
 * **流程**：
 * 1. 查询当前资源 UTXO
 * 2. 解析资源 ID（txId:outputIndex）
 * 3. 获取当前资源的锁定条件和内容
 * 4. 构建新的锁定条件（SingleKeyLock 指向新所有者）
 * 5. 构建交易草稿（Draft）
 * 6. 调用 `wes_buildTransaction` 获取未签名交易
 * 
 * **注意**：
 * - 资源内容不变，只改变锁定条件
 * - 需要当前所有者签名才能消费旧 UTXO
 */
export async function buildTransferOwnershipTx(
  client: IClient,
  intent: TransferOwnershipIntent
): Promise<UnsignedTransaction> {
  // 1. 解析资源 ID
  const [txId, outputIndexStr] = intent.resourceId.split(':');
  const outputIndex = parseInt(outputIndexStr, 10);
  
  if (!txId || isNaN(outputIndex)) {
    throw new Error(`Invalid resourceId format: ${intent.resourceId}. Expected format: txId:outputIndex`);
  }

  // 2. 查询当前资源 UTXO
  let utxoResult: any;
  try {
    utxoResult = await client.call('wes_getUTXO', [{ txId, outputIndex }]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND')) {
      throw new Error(`Resource UTXO not found or already spent: ${intent.resourceId}. The resource may have been transferred or consumed.`);
    }
    throw new Error(`Failed to query UTXO: ${errorMsg}`);
  }
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  // 解析 UTXO 数据
  const utxoData = utxoResult;
  const utxo = Array.isArray(utxoData.utxos) ? utxoData.utxos[0] : utxoData;
  
  if (!utxo || !utxo.output) {
    throw new Error(`Resource UTXO not found: ${intent.resourceId}. The UTXO may have been spent or the resource ID is incorrect.`);
  }

  const output = utxo.output;
  const resourceOutput = output.resource_output || output.resource;
  
  if (!resourceOutput) {
    throw new Error(`Resource output not found in UTXO: ${intent.resourceId}`);
  }

  // 3. 转换新所有者地址为 hex
  let newOwnerAddressHex: string;
  if (intent.newOwnerAddress.startsWith('0x')) {
    newOwnerAddressHex = intent.newOwnerAddress;
  } else if (isValidAddress(intent.newOwnerAddress)) {
    newOwnerAddressHex = intent.newOwnerAddress.startsWith('0x') 
      ? intent.newOwnerAddress 
      : '0x' + intent.newOwnerAddress;
  } else {
    // 尝试 Base58 解码
    try {
      const { addressBase58ToHexAsync } = await import('../../utils/address');
      newOwnerAddressHex = await addressBase58ToHexAsync(intent.newOwnerAddress);
    } catch (e) {
      throw new Error(`Invalid address format: ${intent.newOwnerAddress}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. 构建新的锁定条件（SingleKeyLock）
  const newLockingConditions = [
    {
      single_key_lock: {
        required_address_hash: newOwnerAddressHex.replace('0x', ''),
        required_algorithm: 'ECDSA_SECP256K1',
        sighash_type: 'SIGHASH_ALL',
      },
    },
  ];

  // 5. 构建交易草稿
  const draft = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txId,
        output_index: outputIndex,
        is_reference_only: false, // 消费原资源 UTXO
      },
    ],
    outputs: [
      {
        owner: newOwnerAddressHex.replace('0x', ''),
        output_type: 'resource',
        resource_output: {
          resource: resourceOutput.resource || resourceOutput,
          creation_timestamp: resourceOutput.creation_timestamp || Math.floor(Date.now() / 1000),
          storage_strategy: resourceOutput.storage_strategy || 'STORAGE_STRATEGY_CONTENT_ADDRESSED',
          is_immutable: resourceOutput.is_immutable !== false,
        },
        locking_conditions: newLockingConditions,
      },
    ],
    metadata: {
      operation: 'transfer_ownership',
      memo: intent.memo || '',
    },
  };

  // 6. 返回 draft 对象（用于签名和提交）
  // 注意：实际签名哈希应该通过 `wes_computeSignatureHashFromDraft` 计算
  return {
    draft,
    inputIndex: 0, // 第一个输入需要签名
  };
}

/**
 * 构建协作者管理交易
 * 
 * **流程**：
 * 1. 查询当前资源 UTXO
 * 2. 解析当前锁定条件（可能是 SingleKey 或 MultiKey）
 * 3. 合并现有协作者和新协作者，构建新的 MultiKeyLock
 * 4. 构建交易草稿
 * 
 * **注意**：
 * - 如果当前是 SingleKeyLock，会转换为 MultiKeyLock（保留原所有者 + 新协作者）
 * - 如果当前是 MultiKeyLock，会合并现有协作者和新协作者
 * - collaborators 可以是地址或公钥（hex 格式）
 */
export async function buildUpdateCollaboratorsTx(
  client: IClient,
  intent: UpdateCollaboratorsIntent
): Promise<UnsignedTransaction> {
  // 1. 解析资源 ID
  const [txId, outputIndexStr] = intent.resourceId.split(':');
  const outputIndex = parseInt(outputIndexStr, 10);
  
  if (!txId || isNaN(outputIndex)) {
    throw new Error(`Invalid resourceId format: ${intent.resourceId}. Expected format: txId:outputIndex`);
  }

  // 2. 查询当前资源 UTXO
  let utxoResult: any;
  try {
    utxoResult = await client.call('wes_getUTXO', [{ txId, outputIndex }]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND')) {
      throw new Error(`Resource UTXO not found or already spent: ${intent.resourceId}. The resource may have been transferred or consumed.`);
    }
    throw new Error(`Failed to query UTXO: ${errorMsg}`);
  }
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  const utxoData = utxoResult;
  const utxo = Array.isArray(utxoData.utxos) ? utxoData.utxos[0] : utxoData;
  
  if (!utxo || !utxo.output) {
    throw new Error(`Resource UTXO not found: ${intent.resourceId}. The UTXO may have been spent or the resource ID is incorrect.`);
  }

  const output = utxo.output;
  const resourceOutput = output.resource_output || output.resource;
  
  if (!resourceOutput) {
    throw new Error(`Resource output not found in UTXO: ${intent.resourceId}`);
  }

  // 3. 解析当前锁定条件
  const currentLockingConditions = output.locking_conditions || [];
  let existingAuthorizedKeys: Array<{ value: string; algorithm: string }> = [];

  // 检查当前锁定条件类型
  for (const condition of currentLockingConditions) {
    if (condition.single_key_lock) {
      // SingleKeyLock：提取地址哈希，转换为公钥格式（简化：使用地址哈希作为标识）
      const addrHash = condition.single_key_lock.required_address_hash;
      existingAuthorizedKeys.push({
        value: addrHash.startsWith('0x') ? addrHash.slice(2) : addrHash,
        algorithm: condition.single_key_lock.required_algorithm || 'ECDSA_SECP256K1',
      });
    } else if (condition.multi_key_lock) {
      // MultiKeyLock：提取现有授权公钥
      const multiKey = condition.multi_key_lock;
      if (Array.isArray(multiKey.authorized_keys)) {
        existingAuthorizedKeys = multiKey.authorized_keys.map((key: any) => ({
          value: typeof key === 'string' 
            ? (key.startsWith('0x') ? key.slice(2) : key)
            : (key.value ? (typeof key.value === 'string' ? (key.value.startsWith('0x') ? key.value.slice(2) : key.value) : bytesToHex(key.value).slice(2)) : ''),
          algorithm: key.algorithm || multiKey.required_algorithm || 'ECDSA_SECP256K1',
        }));
      }
      break; // MultiKeyLock 通常只有一个
    }
  }

  // 4. 处理新协作者地址/公钥
  // 注意：MultiKeyLock 需要公钥，但用户可能提供地址
  // 这里简化处理：假设用户提供的是公钥（hex 格式），或者地址（我们尝试从链上查询）
  const newAuthorizedKeys: Array<{ value: string; algorithm: string }> = [];
  
  for (const collaborator of intent.collaborators) {
    let keyValue: string;
    
    // 移除 0x 前缀
    if (collaborator.startsWith('0x')) {
      keyValue = collaborator.slice(2);
    } else {
      keyValue = collaborator;
    }

    // 验证格式（公钥通常是 66 字符 hex，地址是 40 字符 hex）
    // 这里简化：假设是公钥或地址，直接使用
    newAuthorizedKeys.push({
      value: keyValue,
      algorithm: 'ECDSA_SECP256K1',
    });
  }

  // 5. 合并现有和新协作者（去重）
  const allKeys = [...existingAuthorizedKeys];
  for (const newKey of newAuthorizedKeys) {
    const exists = allKeys.some(k => k.value.toLowerCase() === newKey.value.toLowerCase());
    if (!exists) {
      allKeys.push(newKey);
    }
  }

  // 验证 requiredSignatures
  if (intent.requiredSignatures > allKeys.length) {
    throw new Error(`requiredSignatures (${intent.requiredSignatures}) cannot exceed number of authorized keys (${allKeys.length})`);
  }

  if (intent.requiredSignatures < 1) {
    throw new Error('requiredSignatures must be at least 1');
  }

  // 6. 构建新的 MultiKeyLock
  const newLockingConditions = [
    {
      multi_key_lock: {
        required_signatures: intent.requiredSignatures,
        authorized_keys: allKeys.map(key => ({
          value: key.value.startsWith('0x') ? key.value.slice(2) : key.value,
          algorithm: key.algorithm || 'ECDSA_SECP256K1',
        })),
        required_algorithm: 'ECDSA_SECP256K1',
        require_ordered_signatures: false,
        sighash_type: 'SIGHASH_ALL',
      },
    },
  ];

  // 7. 构建交易草稿
  const draft = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txId,
        output_index: outputIndex,
        is_reference_only: false, // 消费原资源 UTXO
      },
    ],
    outputs: [
      {
        owner: output.owner || (existingAuthorizedKeys[0]?.value || ''),
        output_type: 'resource',
        resource_output: {
          resource: resourceOutput.resource || resourceOutput,
          creation_timestamp: resourceOutput.creation_timestamp || Math.floor(Date.now() / 1000),
          storage_strategy: resourceOutput.storage_strategy || 'STORAGE_STRATEGY_CONTENT_ADDRESSED',
          is_immutable: resourceOutput.is_immutable !== false,
        },
        locking_conditions: newLockingConditions,
      },
    ],
    metadata: {
      operation: 'update_collaborators',
      required_signatures: intent.requiredSignatures,
      collaborators_count: allKeys.length,
    },
  };

  // 8. 返回 draft 对象
  return {
    draft,
    inputIndex: 0, // 第一个输入需要签名
  };
}

/**
 * 构建委托授权交易
 * 
 * **流程**：
 * 1. 查询当前资源 UTXO
 * 2. 解析当前锁定条件（保留原有锁定条件）
 * 3. 添加 DelegationLock 到锁定条件列表
 * 4. 构建交易草稿
 * 
 * **注意**：
 * - DelegationLock 是附加锁定条件，不会替换原有锁定条件
 * - 原始所有者仍然可以通过原有锁定条件使用资源
 * - 被委托者只能使用授权的操作类型
 */
export async function buildGrantDelegationTx(
  client: IClient,
  intent: GrantDelegationIntent
): Promise<UnsignedTransaction> {
  // 1. 解析资源 ID
  const [txId, outputIndexStr] = intent.resourceId.split(':');
  const outputIndex = parseInt(outputIndexStr, 10);
  
  if (!txId || isNaN(outputIndex)) {
    throw new Error(`Invalid resourceId format: ${intent.resourceId}. Expected format: txId:outputIndex`);
  }

  // 2. 查询当前资源 UTXO
  let utxoResult: any;
  try {
    utxoResult = await client.call('wes_getUTXO', [{ txId, outputIndex }]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND')) {
      throw new Error(`Resource UTXO not found or already spent: ${intent.resourceId}. The resource may have been transferred or consumed.`);
    }
    throw new Error(`Failed to query UTXO: ${errorMsg}`);
  }
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  const utxoData = utxoResult;
  const utxo = Array.isArray(utxoData.utxos) ? utxoData.utxos[0] : utxoData;
  
  if (!utxo || !utxo.output) {
    throw new Error(`Resource UTXO not found: ${intent.resourceId}. The UTXO may have been spent or the resource ID is incorrect.`);
  }

  const output = utxo.output;
  const resourceOutput = output.resource_output || output.resource;
  
  if (!resourceOutput) {
    throw new Error(`Resource output not found in UTXO: ${intent.resourceId}`);
  }

  // 3. 转换原始所有者地址（从当前锁定条件提取，或使用钱包地址）
  let originalOwnerHex: string | undefined;
  const currentLockingConditions = output.locking_conditions || [];
  
  if (currentLockingConditions.length === 0) {
    throw new Error(`No locking conditions found for resource ${intent.resourceId}. Cannot grant delegation.`);
  }
  
  // 尝试从 SingleKeyLock 或 MultiKeyLock 提取所有者
  for (const condition of currentLockingConditions) {
    if (condition.single_key_lock) {
      originalOwnerHex = condition.single_key_lock.required_address_hash;
      if (!originalOwnerHex.startsWith('0x')) {
        originalOwnerHex = '0x' + originalOwnerHex;
      }
      break;
    } else if (condition.multi_key_lock) {
      // MultiKeyLock：使用第一个授权密钥作为原始所有者标识
      const keys = condition.multi_key_lock.authorized_keys || [];
      if (keys.length > 0) {
        const firstKey = keys[0];
        originalOwnerHex = typeof firstKey === 'string' 
          ? (firstKey.startsWith('0x') ? firstKey : '0x' + firstKey)
          : (firstKey.value ? (typeof firstKey.value === 'string' ? (firstKey.value.startsWith('0x') ? firstKey.value : '0x' + firstKey.value) : bytesToHex(firstKey.value)) : undefined);
        if (originalOwnerHex) {
          break;
        }
      }
    }
  }

  if (!originalOwnerHex) {
    throw new Error(`Cannot determine original owner from current locking conditions for resource ${intent.resourceId}. The resource may have an unsupported locking condition type.`);
  }

  // 4. 转换被委托者地址
  let delegateAddressHex: string;
  if (intent.delegateAddress.startsWith('0x')) {
    delegateAddressHex = intent.delegateAddress;
  } else if (isValidAddress(intent.delegateAddress)) {
    delegateAddressHex = intent.delegateAddress.startsWith('0x') 
      ? intent.delegateAddress 
      : '0x' + intent.delegateAddress;
  } else {
    // 尝试 Base58 解码
    try {
      const { addressBase58ToHexAsync } = await import('../../utils/address');
      delegateAddressHex = await addressBase58ToHexAsync(intent.delegateAddress);
    } catch (e) {
      throw new Error(`Invalid delegate address format: ${intent.delegateAddress}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 5. 验证授权操作类型
  const validOperations = ['reference', 'execute', 'query', 'consume', 'transfer', 'stake', 'vote'];
  const invalidOps = intent.operations.filter(op => !validOperations.includes(op));
  if (invalidOps.length > 0) {
    throw new Error(`Invalid authorized operations: ${invalidOps.join(', ')}. Valid operations: ${validOperations.join(', ')}`);
  }

  // 6. 构建 DelegationLock
  const delegationLock = {
    delegation_lock: {
      original_owner: originalOwnerHex.replace('0x', ''),
      allowed_delegates: [delegateAddressHex.replace('0x', '')],
      authorized_operations: intent.operations,
      expiry_duration_blocks: intent.expiryBlocks > 0 ? intent.expiryBlocks : undefined,
      max_value_per_operation: intent.maxValuePerOperation ? BigInt(intent.maxValuePerOperation).toString() : '0',
      delegation_policy: intent.delegateAddress, // 简化：使用地址作为策略标识
    },
  };

  // 7. 合并原有锁定条件和新的 DelegationLock
  const newLockingConditions = [...currentLockingConditions, delegationLock];

  // 8. 构建交易草稿
  const draft = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txId,
        output_index: outputIndex,
        is_reference_only: false, // 消费原资源 UTXO
      },
    ],
    outputs: [
      {
        owner: originalOwnerHex.replace('0x', ''),
        output_type: 'resource',
        resource_output: {
          resource: resourceOutput.resource || resourceOutput,
          creation_timestamp: resourceOutput.creation_timestamp || Math.floor(Date.now() / 1000),
          storage_strategy: resourceOutput.storage_strategy || 'STORAGE_STRATEGY_CONTENT_ADDRESSED',
          is_immutable: resourceOutput.is_immutable !== false,
        },
        locking_conditions: newLockingConditions,
      },
    ],
    metadata: {
      operation: 'grant_delegation',
      delegate_address: delegateAddressHex,
      authorized_operations: intent.operations.join(','),
      expiry_blocks: intent.expiryBlocks,
    },
  };

  // 9. 返回 draft 对象
  return {
    draft,
    inputIndex: 0, // 第一个输入需要签名
  };
}

/**
 * 构建时间/高度锁交易
 * 
 * **流程**：
 * 1. 查询当前资源 UTXO
 * 2. 解析当前锁定条件（作为 base_lock）
 * 3. 构建 TimeLock 或 HeightLock（包装 base_lock）
 * 4. 构建交易草稿
 * 
 * **注意**：
 * - TimeLock/HeightLock 是包装锁，会包装原有的锁定条件
 * - 如果已有 TimeLock/HeightLock，会替换它
 */
export async function buildSetLockTx(
  client: IClient,
  intent: SetTimeOrHeightLockIntent
): Promise<UnsignedTransaction> {
  // 1. 解析资源 ID
  const [txId, outputIndexStr] = intent.resourceId.split(':');
  const outputIndex = parseInt(outputIndexStr, 10);
  
  if (!txId || isNaN(outputIndex)) {
    throw new Error(`Invalid resourceId format: ${intent.resourceId}. Expected format: txId:outputIndex`);
  }

  // 2. 验证参数
  if (!intent.unlockTimestamp && !intent.unlockHeight) {
    throw new Error('Either unlockTimestamp or unlockHeight must be provided');
  }

  if (intent.unlockTimestamp && intent.unlockHeight) {
    throw new Error('Cannot set both unlockTimestamp and unlockHeight');
  }

  // 3. 查询当前资源 UTXO
  const utxoResult = await client.call('wes_getUTXO', [{ txId, outputIndex }]);
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  const utxoData = utxoResult;
  const utxo = Array.isArray(utxoData.utxos) ? utxoData.utxos[0] : utxoData;
  
  if (!utxo || !utxo.output) {
    throw new Error(`Resource UTXO not found: ${intent.resourceId}`);
  }

  const output = utxo.output;
  const resourceOutput = output.resource_output || output.resource;
  
  if (!resourceOutput) {
    throw new Error(`Resource output not found in UTXO: ${intent.resourceId}`);
  }

  // 4. 解析当前锁定条件（作为 base_lock）
  const currentLockingConditions = output.locking_conditions || [];
  
  // 查找非 TimeLock/HeightLock 的锁定条件作为 base_lock
  let baseLock: any = null;
  for (const condition of currentLockingConditions) {
    if (!condition.time_lock && !condition.height_lock) {
      baseLock = condition;
      break;
    } else if (condition.time_lock) {
      // 如果已有 TimeLock，提取其 base_lock
      baseLock = condition.time_lock.base_lock;
      break;
    } else if (condition.height_lock) {
      // 如果已有 HeightLock，提取其 base_lock
      baseLock = condition.height_lock.base_lock;
      break;
    }
  }

  // 如果没有找到 base_lock，创建一个默认的 SingleKeyLock（使用输出所有者）
  if (!baseLock) {
    const owner = output.owner || '';
    baseLock = {
      single_key_lock: {
        required_address_hash: owner.startsWith('0x') ? owner.slice(2) : owner,
        required_algorithm: 'ECDSA_SECP256K1',
        sighash_type: 'SIGHASH_ALL',
      },
    };
  }

  // 5. 构建新的锁定条件
  let newLockingCondition: any;
  
  if (intent.unlockTimestamp) {
    // TimeLock
    newLockingCondition = {
      time_lock: {
        unlock_timestamp: intent.unlockTimestamp,
        base_lock: baseLock,
        time_source: 'TIME_SOURCE_BLOCK_TIMESTAMP',
      },
    };
  } else {
    // HeightLock
    // 需要获取当前区块高度来计算相对高度（如果提供的是相对高度）
    let unlockHeight = intent.unlockHeight!;
    
    // 如果 unlockHeight 看起来是相对高度（小于当前可能的高度），尝试查询当前高度
    if (unlockHeight < 1000000) { // 假设这是相对高度
      try {
        const currentHeightResult = await client.call('wes_blockNumber', []);
        let currentHeight = 0;
        
        if (typeof currentHeightResult === 'string') {
          const cleanHex = currentHeightResult.startsWith('0x') ? currentHeightResult.slice(2) : currentHeightResult;
          currentHeight = parseInt(cleanHex, 16) || parseInt(cleanHex, 10) || 0;
        } else if (typeof currentHeightResult === 'number') {
          currentHeight = currentHeightResult;
        }
        
        if (currentHeight > 0) {
          unlockHeight = currentHeight + unlockHeight; // 相对高度转换为绝对高度
        }
      } catch (e) {
        // 忽略错误，使用提供的值作为绝对高度
      }
    }
    
    newLockingCondition = {
      height_lock: {
        unlock_height: unlockHeight,
        base_lock: baseLock,
        confirmation_blocks: 6, // 默认确认区块数
      },
    };
  }

  // 6. 构建交易草稿
  const draft = {
    sign_mode: 'defer_sign',
    inputs: [
      {
        tx_hash: txId,
        output_index: outputIndex,
        is_reference_only: false, // 消费原资源 UTXO
      },
    ],
    outputs: [
      {
        owner: output.owner || '',
        output_type: 'resource',
        resource_output: {
          resource: resourceOutput.resource || resourceOutput,
          creation_timestamp: resourceOutput.creation_timestamp || Math.floor(Date.now() / 1000),
          storage_strategy: resourceOutput.storage_strategy || 'STORAGE_STRATEGY_CONTENT_ADDRESSED',
          is_immutable: resourceOutput.is_immutable !== false,
        },
        locking_conditions: [newLockingCondition],
      },
    ],
    metadata: {
      operation: intent.unlockTimestamp ? 'set_time_lock' : 'set_height_lock',
      unlock_timestamp: intent.unlockTimestamp,
      unlock_height: intent.unlockHeight,
    },
  };

  // 7. 返回 draft 对象
  return {
    draft,
    inputIndex: 0, // 第一个输入需要签名
  };
}

