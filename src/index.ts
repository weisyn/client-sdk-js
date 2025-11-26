/**
 * @weisyn/client-sdk-js
 * WES 区块链客户端开发工具包 - JavaScript/TypeScript 版本
 */

// 核心客户端
export { Client } from "./client/client";
export { createClient } from "./client/client";
export { HTTPClient } from "./client/http";
export { WebSocketClient } from "./client/websocket";
export type { ClientConfig, Protocol } from "./client/types";

// WESClient 类型化 API
export { WESClientImpl, WESClientError } from "./client/wesclient";
export type { WESClient, WESClientErrorCode } from "./client/wesclient";
export type {
  OutPoint,
  UTXO,
  ResourceInfo,
  ResourceFilters,
  TransactionInfo,
  TransactionFilters,
  EventInfo,
  EventFilters,
  NodeInfo,
  Transaction,
  SubmitTxResult,
  ResourceType,
  TransactionStatus,
  LockingCondition,
  TxInput,
  TxOutput,
} from "./client/wesclient-types";

// 业务服务
export { TokenService } from "./services/token/service";
export { StakingService } from "./services/staking/service";
export { MarketService } from "./services/market/service";
export { GovernanceService } from "./services/governance/service";
export { ResourceService } from "./services/resource/service";
export { PermissionService } from "./services/permission/service";
export { ContractService } from "./services/contract/service";
export { TransactionServiceImpl } from "./services/transaction/service";
export { EventServiceImpl } from "./services/event/service";
export type { TransactionService } from "./services/transaction/service";
export type { EventService } from "./services/event/service";

// 业务服务类型
export * from "./services/token/types";
export * from "./services/staking/types";
export * from "./services/market/types";
export * from "./services/governance/types";
export * from "./services/resource/types";
// 导出 Resource 服务的 LockingCondition（业务层完整定义）
export type { LockingCondition as ResourceLockingCondition } from "./services/resource/locking";
export * from "./services/contract/types";
export * from "./services/transaction/types";
export * from "./services/event/types";

// 钱包功能
export { Wallet } from "./wallet/wallet";
export { Keystore } from "./wallet/keystore";

// 工具函数
export * from "./utils/address";
export * from "./utils/hex";
export * from "./utils/wesclient-helpers";
export * from "./utils/batch_helpers";
export * from "./utils/cache";
export * from "./utils/batch";
export * from "./utils/tx_utils";
// ABI Helper（遵循 WES ABI 规范）
export * from "./utils/abi";

// 权限服务
export * from "./services/permission/types";
export * from "./services/permission/tx_builder";
export type { TransactionResult } from "./services/permission/service";

// 类型定义
export * from "./client/types";
export type { SubscribeParams, SubscriptionType } from "./client/types";
// Event 和 EventSubscription 从 wesclient-types 导出，避免重复
export type { Event, EventSubscription } from "./client/wesclient-types";
export * from "./services/token/types";
export * from "./services/staking/types";
export * from "./services/market/types";
export * from "./services/governance/types";
export * from "./services/resource/types";
export * from "./wallet/types";

// WES Error Specification
export { WesError, Layer, ErrorCode } from "./types/wes-problem-details";
export type { WesProblemDetails } from "./types/wes-problem-details";
export {
  parseProblemDetails,
  parseProblemDetailsFromRPCError,
  createDefaultWesError,
} from "./types/wes-problem-details";
