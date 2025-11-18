/**
 * @weisyn/client-sdk-js
 * WES 区块链客户端开发工具包 - JavaScript/TypeScript 版本
 */

// 核心客户端
export { Client } from './client/client';
export { createClient } from './client/client';
export { HTTPClient } from './client/http';
export { WebSocketClient } from './client/websocket';
export type { ClientConfig, Protocol } from './client/types';

// 业务服务
export { TokenService } from './services/token/service';
export { StakingService } from './services/staking/service';
export { MarketService } from './services/market/service';
export { GovernanceService } from './services/governance/service';
export { ResourceService } from './services/resource/service';

// 业务服务类型
export * from './services/token/types';
export * from './services/staking/types';
export * from './services/market/types';
export * from './services/governance/types';
export * from './services/resource/types';

// 钱包功能
export { Wallet } from './wallet/wallet';
export { Keystore } from './wallet/keystore';

// 工具函数
export * from './utils/address';
export * from './utils/hex';

// 类型定义
export * from './client/types';
export type { Event, EventSubscription, SubscribeParams, SubscriptionType } from './client/types';
export * from './services/token/types';
export * from './services/staking/types';
export * from './services/market/types';
export * from './services/governance/types';
export * from './services/resource/types';
export * from './wallet/types';

