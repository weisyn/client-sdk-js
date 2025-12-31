/**
 * WESClient 类型定义
 *
 * 基于 _dev/DOMAIN_MODEL.md 和 _dev/CLIENT_API_DESIGN.md
 */

/**
 * OutPoint - UTXO 引用点
 */
export interface OutPoint {
  txId: string;
  outputIndex: number;
}

/**
 * LockingCondition - 锁定条件（协议级）
 */
export interface LockingCondition {
  // TODO: 根据实际协议定义填充
  [key: string]: any;
}

/**
 * TxOutput - 交易输出（协议级）
 */
export interface TxOutput {
  // TODO: 根据实际协议定义填充
  [key: string]: any;
}

/**
 * UTXO - 未花费交易输出
 */
export interface UTXO {
  outPoint: OutPoint;
  output: TxOutput;
  lockingCondition: LockingCondition;
}

/**
 * ResourceType - 资源类型
 */
export type ResourceType = "contract" | "model" | "static";

/**
 * ResourceInfo - 资源信息（协议级）
 */
export interface ResourceInfo {
  resourceId: Uint8Array; // 32 字节哈希（资源 ID）
  resourceType: ResourceType; // 'contract' | 'model' | 'static'
  contentHash: Uint8Array; // 32 字节哈希
  size: number; // 字节数
  mimeType?: string; // 静态资源的 MIME 类型
  lockingConditions: LockingCondition[]; // 原始锁定条件（协议模型）
  createdAt: Date; // 创建时间（从 TX 推导）

  // 元数据字段（来自链上，可能为空）
  name?: string; // 资源名称（来自链上 metadata）
  version?: string; // 版本号（来自链上 metadata）
  description?: string; // 描述（来自链上 metadata）
  creatorAddress?: string; // 创建者地址（来自链上 metadata）
  tags?: string[]; // 标签（来自链上 custom_attributes 或 metadata）
  customAttributes?: Record<string, any>; // 自定义属性（来自链上 custom_attributes）
}

/**
 * ResourceFilters - 资源查询过滤器
 */
export interface ResourceFilters {
  resourceType?: ResourceType; // 'contract' | 'model' | 'static'
  owner?: Uint8Array; // 地址字节（前端一般以 base58/hex 表达）
  limit?: number;
  offset?: number;
}

/**
 * TransactionStatus - 交易状态
 */
export type TransactionStatus = "pending" | "confirmed" | "failed";

/**
 * TxInput - 交易输入（协议级）
 */
export interface TxInput {
  // TODO: 根据实际协议定义填充
  [key: string]: any;
}

/**
 * TransactionInfo - 交易信息（协议级）
 */
export interface TransactionInfo {
  txId: string; // 交易哈希
  status: TransactionStatus; // 'pending' | 'confirmed' | 'failed'
  inputs: TxInput[]; // 协议级输入
  outputs: TxOutput[]; // 协议级输出
  blockHeight?: number;
  timestamp: Date;
}

/**
 * TransactionFilters - 交易查询过滤器
 */
export interface TransactionFilters {
  resourceId?: Uint8Array;
  txId?: string;
  limit?: number;
  offset?: number;
}

/**
 * EventInfo - 事件信息（协议级）
 */
export interface EventInfo {
  eventName: string;
  resourceId: Uint8Array;
  data: Uint8Array;
  txId: string;
  blockHeight?: number;
  timestamp: Date;
}

/**
 * EventFilters - 事件查询过滤器
 */
export interface EventFilters {
  resourceId?: Uint8Array;
  eventName?: string;
  limit?: number;
  offset?: number;
}

/**
 * NodeInfo - 节点信息
 */
export interface NodeInfo {
  rpcVersion: string;
  chainId: string;
  blockHeight: number;
}

/**
 * Transaction - 交易（序列化前）
 */
export type Transaction =
  | string
  | {
      // TODO: 根据实际交易结构定义
      [key: string]: any;
    };

/**
 * SubmitTxResult - 交易提交结果
 */
export interface SubmitTxResult {
  txHash: string;
  accepted: boolean;
  reason?: string;
}

/**
 * EventSubscription - 事件订阅
 * 与 client/types.ts 中的 EventSubscription 兼容
 */
export interface EventSubscription {
  id: string;
  on(event: "event", callback: (event: Event) => void): void;
  unsubscribe(): Promise<void>;
}

/**
 * Event - 事件
 * 与 client/types.ts 中的 Event 兼容
 */
export interface Event {
  topic: string;
  data: Uint8Array;
  blockHeight?: number;
  txHash?: string;
}

// ========== 新增类型定义（API 补齐） ==========

/**
 * BlockInfo - 区块信息
 */
export interface BlockInfo {
  height: number; // 区块高度
  hash: Uint8Array; // 区块哈希（32字节）
  parentHash: Uint8Array; // 父区块哈希（32字节）
  timestamp: Date; // 区块时间戳
  stateRoot: Uint8Array; // 状态根（32字节）
  difficulty: string; // 难度
  miner: string; // 矿工地址
  size: number; // 区块大小（字节）
  txHashes: string[]; // 交易哈希列表（fullTx=false 时）
  transactions: TransactionInfo[]; // 完整交易列表（fullTx=true 时）
  txCount: number; // 交易数量
}

/**
 * TransactionReceipt - 交易收据
 */
export interface TransactionReceipt {
  txHash: string; // tx_hash（0x + 64hex）
  txIndex: number; // tx_index
  blockHeight: number; // block_height
  blockHash: Uint8Array; // block_hash
  status: "0x1" | "0x0"; // status
  statusReason?: string; // statusReason（可选）
  executionResultHash?: Uint8Array; // execution_result_hash（可选）
  stateRoot?: Uint8Array; // state_root（可选）
  timestamp?: number; // timestamp（秒）
}

/**
 * FeeEstimate - 费用估算结果
 */
export interface FeeEstimate {
  estimatedFee: bigint; // estimated_fee
  feeRate: string; // fee_rate
  numInputs: number; // num_inputs
  numOutputs: number; // num_outputs
}

/**
 * SyncStatus - 同步状态
 */
export interface SyncStatus {
  syncing: boolean; // 是否正在同步
  currentHeight: number; // 当前高度
  highestHeight: number; // 网络最高高度
  startingBlock: number; // 同步起始区块
  progress: number; // 同步进度（0-1）
}

/**
 * TokenBalance - 代币余额
 */
export interface TokenBalance {
  address: string; // 查询的地址
  contractHash: string; // 合约内容哈希
  contractAddress: string; // 合约地址
  tokenId: string; // 代币 ID
  balance: string; // 余额（字符串格式，支持大数）
  balanceUint64?: bigint; // 余额（bigint 格式）
  utxoCount: number; // UTXO 数量
  height: number; // 查询时的区块高度
}

/**
 * AIModelCallRequest - AI 模型调用请求
 */
export interface AIModelCallRequest {
  privateKey?: string; // return_unsigned_tx=false 时必需
  modelHash: Uint8Array; // 模型内容哈希（32字节）
  inputs: Record<string, unknown>[]; // 张量输入列表（与节点 API 对齐）
  returnUnsignedTx?: boolean; // true 时仅返回 unsigned_tx
  paymentToken?: string; // 可选：支付代币
}

/**
 * AIModelCallResult - AI 模型调用结果
 */
export interface AIModelCallResult {
  success: boolean; // success
  txHash?: string; // tx_hash
  unsignedTx?: string; // unsigned_tx（hex，不带 0x）
  outputs?: unknown; // outputs
  message?: string; // message
  computeInfo?: unknown; // compute_info
}
