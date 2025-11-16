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
  /** 提案类型 */
  proposalType: string;
  /** 提案参数 */
  params?: Record<string, any>;
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
  /** 投票选项（支持/反对/弃权） */
  support: 'for' | 'against' | 'abstain';
  /** 投票权重（可选） */
  weight?: bigint | number;
}

/**
 * 投票结果
 */
export interface VoteResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}
