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
export type ResourceType = 'contract' | 'model' | 'static';

/**
 * ResourceInfo - 资源信息（协议级）
 */
export interface ResourceInfo {
  resourceId: Uint8Array;          // 32 字节哈希（资源 ID）
  resourceType: ResourceType;      // 'contract' | 'model' | 'static'
  contentHash: Uint8Array;         // 32 字节哈希
  size: number;                    // 字节数
  mimeType?: string;               // 静态资源的 MIME 类型
  lockingConditions: LockingCondition[]; // 原始锁定条件（协议模型）
  createdAt: Date;                 // 创建时间（从 TX 推导）
  
  // 元数据字段（来自链上，可能为空）
  name?: string;                   // 资源名称（来自链上 metadata）
  version?: string;                // 版本号（来自链上 metadata）
  description?: string;            // 描述（来自链上 metadata）
  creatorAddress?: string;        // 创建者地址（来自链上 metadata）
  tags?: string[];                 // 标签（来自链上 custom_attributes 或 metadata）
  customAttributes?: Record<string, any>; // 自定义属性（来自链上 custom_attributes）
}

/**
 * ResourceFilters - 资源查询过滤器
 */
export interface ResourceFilters {
  resourceType?: ResourceType;   // 'contract' | 'model' | 'static'
  owner?: Uint8Array;            // 地址字节（前端一般以 base58/hex 表达）
  limit?: number;
  offset?: number;
}

/**
 * TransactionStatus - 交易状态
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

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
  txId: string;                 // 交易哈希
  status: TransactionStatus;    // 'pending' | 'confirmed' | 'failed'
  inputs: TxInput[];           // 协议级输入
  outputs: TxOutput[];         // 协议级输出
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
export type Transaction = string | {
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
  on(event: 'event', callback: (event: Event) => void): void;
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

