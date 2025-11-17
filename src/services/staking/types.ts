/**
 * Staking 服务类型定义
 */

/**
 * 质押请求
 */
export interface StakeRequest {
  /** 质押者地址（20字节） */
  from: Uint8Array;
  /** 验证者地址（20字节） */
  validatorAddr: Uint8Array;
  /** 质押金额 */
  amount: bigint | number;
  /** 锁定期（区块数） */
  lockBlocks?: bigint | number;
}

/**
 * 质押结果
 */
export interface StakeResult {
  /** 质押ID */
  stakeId: string;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 解质押请求
 */
export interface UnstakeRequest {
  /** 质押者地址（20字节） */
  from: Uint8Array;
  /** 质押ID */
  stakeId: Uint8Array;
  /** 解除质押金额（0表示全部） */
  amount: bigint | number;
}

/**
 * 解质押结果
 */
export interface UnstakeResult {
  /** 交易哈希 */
  txHash: string;
  /** 解除质押金额 */
  unstakeAmount: bigint;
  /** 奖励金额 */
  rewardAmount: bigint;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 委托请求
 */
export interface DelegateRequest {
  /** 委托者地址（20字节） */
  from: Uint8Array;
  /** 验证者地址（20字节） */
  validatorAddr: Uint8Array;
  /** 委托金额 */
  amount: bigint | number;
}

/**
 * 委托结果
 */
export interface DelegateResult {
  /** 委托ID */
  delegateId: string;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 取消委托请求
 */
export interface UndelegateRequest {
  /** 委托者地址（20字节） */
  from: Uint8Array;
  /** 委托ID */
  delegateId: Uint8Array;
  /** 取消委托金额（0表示全部） */
  amount: bigint | number;
}

/**
 * 取消委托结果
 */
export interface UndelegateResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 领取奖励请求
 */
export interface ClaimRewardRequest {
  /** 领取者地址（20字节） */
  from: Uint8Array;
  /** 质押ID（可选） */
  stakeId?: Uint8Array;
  /** 委托ID（可选） */
  delegateId?: Uint8Array;
}

/**
 * 领取奖励结果
 */
export interface ClaimRewardResult {
  /** 交易哈希 */
  txHash: string;
  /** 奖励金额 */
  rewardAmount: bigint;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 罚没请求
 */
export interface SlashRequest {
  /** 被罚没的验证者地址（20字节） */
  validatorAddr: Uint8Array;
  /** 罚没金额 */
  amount: bigint | number;
  /** 罚没原因 */
  reason: string;
}

/**
 * 罚没结果
 */
export interface SlashResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

