/**
 * Governance 服务类型定义
 */

/**
 * 提案请求
 */
export interface ProposeRequest {
  /** 提案者地址（20字节） */
  proposer: Uint8Array;
  /** 提案标题 */
  title: string;
  /** 提案描述 */
  description: string;
  /** 投票期限（区块数） */
  votingPeriod: bigint | number;
}

/**
 * 提案结果
 */
export interface ProposeResult {
  /** 提案ID */
  proposalId: string;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 投票请求
 */
export interface VoteRequest {
  /** 投票者地址（20字节） */
  voter: Uint8Array;
  /** 提案ID */
  proposalId: Uint8Array;
  /** 投票选择（1=支持, 0=反对, -1=弃权） */
  choice: number;
  /** 投票权重 */
  voteWeight: bigint | number;
}

/**
 * 投票结果
 */
export interface VoteResult {
  /** 投票ID */
  voteId: string;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 更新参数请求
 */
export interface UpdateParamRequest {
  /** 提案者地址（20字节） */
  proposer: Uint8Array;
  /** 参数键 */
  paramKey: string;
  /** 参数值 */
  paramValue: string;
}

/**
 * 更新参数结果
 */
export interface UpdateParamResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}
