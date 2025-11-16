/**
 * Token 服务类型定义
 */

/**
 * 转账请求
 */
export interface TransferRequest {
  /** 发送方地址 */
  from: Uint8Array;
  /** 接收方地址 */
  to: Uint8Array;
  /** 转账金额 */
  amount: bigint | number;
  /** 代币 ID（null 表示原生币） */
  tokenId: Uint8Array | null;
}

/**
 * 转账结果
 */
export interface TransferResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 批量转账请求
 */
export interface BatchTransferRequest {
  /** 发送方地址 */
  from: Uint8Array;
  /** 转账列表（所有转账必须使用同一个 tokenID） */
  transfers: Array<{
    /** 接收方地址 */
    to: Uint8Array;
    /** 转账金额 */
    amount: bigint | number;
  }>;
  /** 代币 ID（所有转账必须使用同一个） */
  tokenId: Uint8Array;
}

/**
 * 批量转账结果
 */
export interface BatchTransferResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 铸造请求
 */
export interface MintRequest {
  /** 接收方地址 */
  to: Uint8Array;
  /** 铸造数量 */
  amount: bigint | number;
  /** 代币 ID */
  tokenId: Uint8Array;
  /** 合约地址 */
  contractAddr: Uint8Array;
}

/**
 * 铸造结果
 */
export interface MintResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 销毁请求
 */
export interface BurnRequest {
  /** 发送方地址 */
  from: Uint8Array;
  /** 销毁数量 */
  amount: bigint | number;
  /** 代币 ID */
  tokenId: Uint8Array;
}

/**
 * 销毁结果
 */
export interface BurnResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}
