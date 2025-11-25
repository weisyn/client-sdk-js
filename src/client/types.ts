/**
 * Client 类型定义
 */

import type { RetryConfig } from "../utils/retry";

/**
 * 传输协议类型
 */
export type Protocol = "http" | "websocket";

/**
 * 客户端配置
 */
export interface ClientConfig {
  /** 节点端点 URL */
  endpoint: string;
  /** 传输协议 */
  protocol: Protocol;
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 是否启用调试日志 */
  debug?: boolean;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 重试配置 */
  retry?: RetryConfig;
}

/**
 * JSON-RPC 请求
 */
export interface JSONRPCRequest {
  jsonrpc: "2.0";
  method: string;
  params: any[];
  id: number | string;
}

/**
 * JSON-RPC 响应
 */
export interface JSONRPCResponse<T = any> {
  jsonrpc: "2.0";
  result?: T;
  error?: JSONRPCError;
  id: number | string;
}

/**
 * JSON-RPC 错误
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

/**
 * 订阅类型
 */
export type SubscriptionType = "newHeads" | "logs" | "newPendingTxs" | "syncing";

/**
 * 事件过滤器（用于合约事件订阅）
 */
export interface EventFilter {
  /** 事件主题列表 */
  topics?: string[];
  /** 发送方地址 */
  from?: Uint8Array;
  /** 接收方地址 */
  to?: Uint8Array;
}

/**
 * 订阅参数（支持订阅类型字符串或事件过滤器）
 */
export type SubscribeParams = SubscriptionType | EventFilter;

/**
 * 事件
 */
export interface Event {
  /** 事件主题 */
  topic: string;
  /** 事件数据 */
  data: Uint8Array;
  /** 区块高度 */
  blockHeight?: number;
  /** 交易哈希 */
  txHash?: string;
}

/**
 * 事件订阅
 */
export interface EventSubscription {
  /** 订阅 ID */
  id: string;
  /** 监听事件 */
  on(event: "event", callback: (event: Event) => void): void;
  /** 取消订阅 */
  unsubscribe(): Promise<void>;
}

/**
 * 交易提交结果
 */
export interface SendTxResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否被接受 */
  accepted: boolean;
  /** 拒绝原因（如果被拒绝） */
  reason?: string;
}
