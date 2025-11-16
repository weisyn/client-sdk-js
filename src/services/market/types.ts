/**
 * Market 服务类型定义
 */

/**
 * 托管请求
 */
export interface EscrowRequest {
  /** 买方地址（20字节） */
  buyer: Uint8Array;
  /** 卖方地址（20字节） */
  seller: Uint8Array;
  /** 代币ID */
  tokenId: Uint8Array;
  /** 金额 */
  amount: bigint | number;
  /** 托管条件（可选） */
  conditions?: string;
}

/**
 * 托管结果
 */
export interface EscrowResult {
  /** 托管ID */
  escrowId: string;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 释放请求
 */
export interface ReleaseRequest {
  /** 托管ID */
  escrowId: Uint8Array;
  /** 释放金额 */
  amount: bigint | number;
}

/**
 * 释放结果
 */
export interface ReleaseResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 交换请求
 */
export interface SwapRequest {
  /** 交换发起方地址（20字节） */
  from: Uint8Array;
  /** 交换接收方地址（20字节） */
  to: Uint8Array;
  /** 发送的代币ID */
  fromTokenId: Uint8Array;
  /** 发送的金额 */
  fromAmount: bigint | number;
  /** 接收的代币ID */
  toTokenId: Uint8Array;
  /** 接收的金额 */
  toAmount: bigint | number;
}

/**
 * 交换结果
 */
export interface SwapResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}
