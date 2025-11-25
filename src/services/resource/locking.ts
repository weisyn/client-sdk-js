/**
 * 锁定条件类型定义和转换逻辑
 *
 * 支持 7 种锁定条件：
 * - SingleKeyLock: 单密钥锁定
 * - MultiKeyLock: 多密钥锁定
 * - ContractLock: 合约锁定
 * - DelegationLock: 委托锁定
 * - ThresholdLock: 门限签名锁定
 * - TimeLock: 时间锁定
 * - HeightLock: 高度锁定
 *
 * 详见：workbench/_dev/EXECUTABLE_RESOURCE_LOCKING_DESIGN.md
 */

/**
 * 锁定条件类型
 */
export type LockingConditionType =
  | "singleKey"
  | "multiKey"
  | "contract"
  | "delegation"
  | "threshold"
  | "timeLock"
  | "heightLock";

/**
 * 基础锁定条件接口
 */
export interface BaseLockingCondition {
  type: LockingConditionType;
}

/**
 * 单密钥锁定条件
 */
export interface SingleKeyLockCondition extends BaseLockingCondition {
  type: "singleKey";
  requiredAddressHash: Uint8Array; // 20字节地址哈希
  algorithm?: "ECDSA_SECP256K1" | "ED25519";
}

/**
 * 多密钥锁定条件
 */
export interface MultiKeyLockCondition extends BaseLockingCondition {
  type: "multiKey";
  requiredSignatures: number; // M
  authorizedKeys: PublicKey[]; // N个公钥
  requireOrderedSignatures?: boolean;
}

/**
 * 公钥接口
 */
export interface PublicKey {
  value: Uint8Array;
  algorithm?: "ECDSA_SECP256K1" | "ED25519";
}

/**
 * 时间锁定条件
 */
export interface TimeLockCondition extends BaseLockingCondition {
  type: "timeLock";
  unlockTimestamp: number; // Unix秒
  baseLock: LockingCondition; // 基础锁定条件
}

/**
 * 高度锁定条件
 */
export interface HeightLockCondition extends BaseLockingCondition {
  type: "heightLock";
  unlockHeight: number; // 区块高度
  baseLock: LockingCondition; // 基础锁定条件
  confirmationBlocks?: number;
}

/**
 * 委托锁定条件
 */
export interface DelegationLockCondition extends BaseLockingCondition {
  type: "delegation";
  originalOwner: Uint8Array; // 原始所有者地址
  allowedDelegates: Uint8Array[]; // 被委托者列表
  authorizedOperations: string[]; // ['reference', 'consume', 'execute']
  expiryDurationBlocks?: number; // 有效期（区块数，0=永不过期）
  maxValuePerOperation?: number;
}

/**
 * 合约锁定条件（L1层：资源所有权控制）
 */
export interface ContractLockCondition extends BaseLockingCondition {
  type: "contract";
  contractAddress: Uint8Array; // 治理合约地址
  requiredMethod: string; // 要求调用的方法名
  parameterSchema?: string; // 参数类型定义
  stateRequirements?: string[]; // 状态要求
  maxExecutionTimeMs?: number;
}

/**
 * 门限签名锁定条件
 */
export interface ThresholdLockCondition extends BaseLockingCondition {
  type: "threshold";
  threshold: number; // 门限值
  totalParties: number; // 总参与方数
  partyVerificationKeys: Uint8Array[]; // 参与方验证密钥
  signatureScheme?: string; // 'BLS_THRESHOLD'
}

/**
 * 锁定条件联合类型
 */
export type LockingCondition =
  | SingleKeyLockCondition
  | MultiKeyLockCondition
  | TimeLockCondition
  | HeightLockCondition
  | DelegationLockCondition
  | ContractLockCondition
  | ThresholdLockCondition;

/**
 * 将 Host ABI 层的 LockingCondition 转换为 proto 格式（JSON-RPC 友好）
 */
export function convertLockingConditionsToProto(conditions: LockingCondition[]): any[] {
  return conditions.map((condition) => {
    switch (condition.type) {
      case "singleKey":
        return {
          type: "singleKey", // ✅ 添加 type 字段，节点端需要
          single_key_lock: {
            required_address_hash: uint8ArrayToHex(condition.requiredAddressHash),
            required_algorithm: condition.algorithm || "ECDSA_SECP256K1",
            sighash_type: "SIGHASH_ALL",
          },
        };
      case "multiKey":
        return {
          type: "multiKey", // ✅ 添加 type 字段
          multi_key_lock: {
            required_signatures: condition.requiredSignatures,
            authorized_keys: condition.authorizedKeys.map((k) => ({
              value: uint8ArrayToHex(k.value),
              algorithm: k.algorithm || "ECDSA_SECP256K1",
            })),
            required_algorithm: "ECDSA_SECP256K1",
            require_ordered_signatures: condition.requireOrderedSignatures ?? false,
            sighash_type: "SIGHASH_ALL",
          },
        };
      case "timeLock":
        return {
          type: "timeLock", // ✅ 添加 type 字段
          time_lock: {
            unlock_timestamp: condition.unlockTimestamp,
            base_lock: convertLockingConditionsToProto([condition.baseLock])[0],
            time_source: "TIME_SOURCE_BLOCK_TIMESTAMP",
          },
        };
      case "heightLock":
        return {
          type: "heightLock", // ✅ 添加 type 字段
          height_lock: {
            unlock_height: condition.unlockHeight,
            base_lock: convertLockingConditionsToProto([condition.baseLock])[0],
            confirmation_blocks: condition.confirmationBlocks ?? 6,
          },
        };
      case "delegation":
        return {
          type: "delegation", // ✅ 添加 type 字段
          delegation_lock: {
            original_owner: uint8ArrayToHex(condition.originalOwner),
            allowed_delegates: condition.allowedDelegates.map((addr) => uint8ArrayToHex(addr)),
            authorized_operations: condition.authorizedOperations,
            expiry_duration_blocks: condition.expiryDurationBlocks ?? 0,
            max_value_per_operation: condition.maxValuePerOperation ?? 0,
          },
        };
      case "contract":
        return {
          type: "contract", // ✅ 添加 type 字段
          contract_lock: {
            contract_address: uint8ArrayToHex(condition.contractAddress),
            required_method: condition.requiredMethod,
            parameter_schema: condition.parameterSchema || "",
            state_requirements: condition.stateRequirements || [],
            max_execution_time_ms: condition.maxExecutionTimeMs ?? 5000,
          },
        };
      case "threshold":
        return {
          type: "threshold", // ✅ 添加 type 字段
          threshold_lock: {
            threshold: condition.threshold,
            total_parties: condition.totalParties,
            party_verification_keys: condition.partyVerificationKeys.map((key) =>
              uint8ArrayToHex(key)
            ),
            signature_scheme: condition.signatureScheme || "BLS_THRESHOLD",
            security_level: 256,
          },
        };
      default:
        throw new Error(`Unsupported locking condition type: ${(condition as any).type}`);
    }
  });
}

/**
 * 创建默认单密钥锁
 */
export function createDefaultSingleKeyLock(address: Uint8Array): any[] {
  return [
    {
      // ✅ 默认锁也需要携带 type 字段，便于节点端解析
      type: "singleKey",
      single_key_lock: {
        required_address_hash: uint8ArrayToHex(address),
        required_algorithm: "ECDSA_SECP256K1",
        sighash_type: "SIGHASH_ALL",
      },
    },
  ];
}

/**
 * 验证锁定条件有效性
 */
export function validateLockingConditions(
  conditions: LockingCondition[],
  allowContractLockCycles: boolean = false
): void {
  // 检查 ContractLock 循环依赖
  const contractAddresses = new Set<string>();
  for (const condition of conditions) {
    if (condition.type === "contract") {
      const addrHex = uint8ArrayToHex(condition.contractAddress);
      if (contractAddresses.has(addrHex)) {
        throw new Error(`Duplicate contract lock address: ${addrHex}`);
      }
      contractAddresses.add(addrHex);

      // TODO: 实现循环检测逻辑
      // 检查 contractAddress 是否形成循环引用
      if (!allowContractLockCycles) {
        // 可以查询链上状态，检查该合约的锁定条件是否又引用了当前合约
        // 这里简化处理，实际应该调用节点 API 检查
      }
    }

    // 验证每种锁定条件的参数有效性
    validateSingleLockingCondition(condition);
  }
}

/**
 * 验证单个锁定条件
 */
function validateSingleLockingCondition(condition: LockingCondition): void {
  switch (condition.type) {
    case "singleKey":
      if (condition.requiredAddressHash.length !== 20) {
        throw new Error("SingleKeyLock: requiredAddressHash must be 20 bytes");
      }
      break;
    case "multiKey":
      if (condition.requiredSignatures <= 0) {
        throw new Error("MultiKeyLock: requiredSignatures must be > 0");
      }
      if (condition.authorizedKeys.length === 0) {
        throw new Error("MultiKeyLock: authorizedKeys cannot be empty");
      }
      if (condition.requiredSignatures > condition.authorizedKeys.length) {
        throw new Error("MultiKeyLock: requiredSignatures cannot exceed authorizedKeys count");
      }
      break;
    case "timeLock":
      if (!condition.baseLock) {
        throw new Error("TimeLock: baseLock is required");
      }
      validateSingleLockingCondition(condition.baseLock);
      break;
    case "heightLock":
      if (!condition.baseLock) {
        throw new Error("HeightLock: baseLock is required");
      }
      validateSingleLockingCondition(condition.baseLock);
      break;
    case "delegation":
      if (condition.originalOwner.length !== 20) {
        throw new Error("DelegationLock: originalOwner must be 20 bytes");
      }
      if (condition.allowedDelegates.length === 0) {
        throw new Error("DelegationLock: allowedDelegates cannot be empty");
      }
      break;
    case "contract":
      if (condition.contractAddress.length !== 20) {
        throw new Error("ContractLock: contractAddress must be 20 bytes");
      }
      if (!condition.requiredMethod || condition.requiredMethod.trim() === "") {
        throw new Error("ContractLock: requiredMethod cannot be empty");
      }
      break;
    case "threshold":
      if (condition.threshold <= 0) {
        throw new Error("ThresholdLock: threshold must be > 0");
      }
      if (condition.totalParties <= 0) {
        throw new Error("ThresholdLock: totalParties must be > 0");
      }
      if (condition.threshold > condition.totalParties) {
        throw new Error("ThresholdLock: threshold cannot exceed totalParties");
      }
      if (condition.partyVerificationKeys.length !== condition.totalParties) {
        throw new Error("ThresholdLock: partyVerificationKeys count must match totalParties");
      }
      break;
  }
}

/**
 * Uint8Array 转十六进制字符串（不带 0x 前缀）
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
