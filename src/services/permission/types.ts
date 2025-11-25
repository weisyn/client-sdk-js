/**
 * 权限交易构建器类型定义
 *
 * 定义权限变更操作的 Intent DTO 和交易构建结果
 */

/**
 * 所有权转移意图
 */
export interface TransferOwnershipIntent {
  resourceId: string; // txId:outputIndex
  newOwnerAddress: string; // Base58 地址或 hex 地址
  memo?: string;
}

/**
 * 协作者/白名单管理意图
 */
export interface UpdateCollaboratorsIntent {
  resourceId: string;
  requiredSignatures: number; // M
  collaborators: string[]; // 授权地址列表（Base58 或 hex）
}

/**
 * 临时授权意图
 */
export interface GrantDelegationIntent {
  resourceId: string;
  delegateAddress: string;
  operations: ("reference" | "execute" | "query" | "consume" | "transfer" | "stake" | "vote")[];
  expiryBlocks: number;
  maxValuePerOperation?: string;
}

/**
 * 时间/高度锁意图
 */
export interface SetTimeOrHeightLockIntent {
  resourceId: string;
  unlockTimestamp?: number; // Unix 秒
  unlockHeight?: number; // 区块高度
}

/**
 * 未签名交易（包含 draft 和签名信息）
 */
export interface UnsignedTransaction {
  draft: object; // 交易草稿（用于签名）
  inputIndex: number; // 需要签名的输入索引
}
