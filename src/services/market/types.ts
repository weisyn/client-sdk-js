/**
 * Market 服务类型定义
 */

/**
 * AMM 交换请求
 */
export interface SwapRequest {
  /** 交换者地址（20字节） */
  from: Uint8Array;
  /** AMM 合约地址（contentHash，32字节） */
  ammContractAddr: Uint8Array;
  /** 输入代币ID（null表示原生币） */
  tokenIn: Uint8Array | null;
  /** 输出代币ID（null表示原生币） */
  tokenOut: Uint8Array | null;
  /** 输入金额 */
  amountIn: bigint | number;
  /** 最小输出金额（滑点保护） */
  amountOutMin: bigint | number;
}

/**
 * AMM 交换结果
 */
export interface SwapResult {
  /** 交易哈希 */
  txHash: string;
  /** 实际输出金额 */
  amountOut: bigint;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 添加流动性请求
 */
export interface AddLiquidityRequest {
  /** 流动性提供者地址（20字节） */
  from: Uint8Array;
  /** AMM 合约地址（contentHash，32字节） */
  ammContractAddr: Uint8Array;
  /** 代币A ID */
  tokenA: Uint8Array;
  /** 代币B ID */
  tokenB: Uint8Array;
  /** 代币A金额 */
  amountA: bigint | number;
  /** 代币B金额 */
  amountB: bigint | number;
}

/**
 * 添加流动性结果
 */
export interface AddLiquidityResult {
  /** 交易哈希 */
  txHash: string;
  /** 流动性ID */
  liquidityId: Uint8Array;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 移除流动性请求
 */
export interface RemoveLiquidityRequest {
  /** 流动性提供者地址（20字节） */
  from: Uint8Array;
  /** AMM 合约地址（contentHash，32字节） */
  ammContractAddr: Uint8Array;
  /** 流动性ID */
  liquidityId: Uint8Array;
  /** 移除金额 */
  amount: bigint | number;
}

/**
 * 移除流动性结果
 */
export interface RemoveLiquidityResult {
  /** 交易哈希 */
  txHash: string;
  /** 获得的代币A金额 */
  amountA: bigint;
  /** 获得的代币B金额 */
  amountB: bigint;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 创建归属计划请求
 */
export interface CreateVestingRequest {
  /** 创建者地址（20字节） */
  from: Uint8Array;
  /** 受益人地址（20字节） */
  to: Uint8Array;
  /** 代币ID（null 表示原生币） */
  tokenId: Uint8Array | null;
  /** 总金额 */
  amount: bigint | number;
  /** 开始时间（Unix时间戳） */
  startTime: bigint | number;
  /** 持续时间（秒） */
  duration: bigint | number;
}

/**
 * 创建归属计划结果
 */
export interface CreateVestingResult {
  /** 交易哈希 */
  txHash: string;
  /** 归属计划ID */
  vestingId: Uint8Array;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 领取归属代币请求
 */
export interface ClaimVestingRequest {
  /** 领取者地址（20字节） */
  from: Uint8Array;
  /** 归属计划ID */
  vestingId: Uint8Array;
}

/**
 * 领取归属代币结果
 */
export interface ClaimVestingResult {
  /** 交易哈希 */
  txHash: string;
  /** 领取金额 */
  claimAmount: bigint;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 创建托管请求
 */
export interface CreateEscrowRequest {
  /** 买方地址（20字节） */
  buyer: Uint8Array;
  /** 卖方地址（20字节） */
  seller: Uint8Array;
  /** 代币ID（null 表示原生币） */
  tokenId: Uint8Array | null;
  /** 托管金额 */
  amount: bigint | number;
  /** 过期时间（Unix时间戳） */
  expiry: bigint | number;
}

/**
 * 创建托管结果
 */
export interface CreateEscrowResult {
  /** 交易哈希 */
  txHash: string;
  /** 托管ID */
  escrowId: Uint8Array;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 释放托管请求
 */
export interface ReleaseEscrowRequest {
  /** 释放者地址（通常是买方，20字节） */
  from: Uint8Array;
  /** 卖方地址（20字节） */
  sellerAddress: Uint8Array;
  /** 托管ID */
  escrowId: Uint8Array;
}

/**
 * 释放托管结果
 */
export interface ReleaseEscrowResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 退款托管请求
 */
export interface RefundEscrowRequest {
  /** 退款者地址（通常是买方或卖方，20字节） */
  from: Uint8Array;
  /** 买方地址（20字节） */
  buyerAddress: Uint8Array;
  /** 托管ID */
  escrowId: Uint8Array;
}

/**
 * 退款托管结果
 */
export interface RefundEscrowResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}
