# SDK 概述

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：draft
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK

---

## 📖 文档前提

> 💡 **重要**：本文档假定你已经了解 WES 的基本概念。如果尚未了解，请先阅读：
> - [WES 项目总览](https://github.com/weisyn/weisyn/blob/main/docs/overview.md)
> - [WES 系统架构](https://github.com/weisyn/weisyn/blob/main/docs/system/architecture/README.md)

本文档从 **SDK 开发者视角**重新解释 WES 的核心概念，帮助你理解如何在 JavaScript/TypeScript 中使用这些概念。

---

## 🎯 SDK 的定位

WES Client SDK (JS/TS) 是 WES 区块链的 **JavaScript/TypeScript 语言绑定层**，提供：

- ✅ **业务语义接口**：Token、Staking、Market、Governance、Resource 等服务
- ✅ **交易构建与签名**：完整的交易生命周期管理
- ✅ **节点交互**：通过 JSON-RPC API 与 WES 节点通信
- ✅ **跨环境支持**：Node.js 和浏览器环境

---

## 🔑 核心概念映射

### 1. UTXO 模型

**WES 概念**：WES 使用 EUTXO（扩展 UTXO）模型，所有状态都通过 UTXO 表示。

**SDK 视角**：

```typescript
// UTXO 在 SDK 中通过以下方式操作：

// 1. 查询 UTXO（通过 Client）
const utxos = await client.call('wes_getUTXO', [addressBase58]);

// 2. 构建交易时引用 UTXO（SDK 自动处理）
const result = await tokenService.transfer({
  from: wallet.address,  // SDK 自动查询并选择 UTXO
  to: recipient.address,
  amount: BigInt(1000000),
  tokenId: null,
}, wallet);

// 3. 交易输出成为新的 UTXO（自动上链）
// 交易确认后，输出自动成为可用的 UTXO
```

**关键理解**：
- SDK 自动处理 UTXO 查询和选择
- 开发者只需关注业务语义（转账、质押等）
- UTXO 的生命周期由 WES 节点管理

---

### 2. 输出类型

**WES 概念**：WES 支持三种输出类型：
- `AssetOutput`：价值载体（代币余额）
- `StateOutput`：证据载体（治理提案、投票记录）
- `ResourceOutput`：能力载体（智能合约、AI 模型、静态资源）

**SDK 视角**：

```typescript
// AssetOutput - Token 服务使用
const transferResult = await tokenService.transfer({...});
// 内部构建 AssetOutput，包含代币金额和所有者

// StateOutput - Governance 服务使用
const proposeResult = await governanceService.propose({...});
// 内部构建 StateOutput，存储提案数据

// ResourceOutput - Resource 服务使用
const deployResult = await resourceService.deployContract({...});
// 内部构建 ResourceOutput，存储合约字节码
```

**关键理解**：
- SDK 根据业务场景自动选择合适的输出类型
- 开发者无需直接操作输出类型
- 通过 Service 方法即可完成业务操作

---

### 3. 锁定条件

**WES 概念**：WES 支持 7 种锁定条件：
- `SingleKeyLock`：单密钥锁
- `MultiKeyLock`：多密钥锁
- `ContractLock`：合约锁
- `DelegationLock`：委托锁
- `ThresholdLock`：阈值锁
- `TimeLock`：时间锁
- `HeightLock`：高度锁

**SDK 视角**：

```typescript
// SingleKeyLock - 默认锁定条件（转账、质押等）
const transferResult = await tokenService.transfer({...});
// SDK 自动使用 SingleKeyLock，需要钱包签名

// MultiKeyLock - 托管场景
const escrowResult = await marketService.createEscrow({
  from: buyer.address,
  seller: seller.address,
  amount: BigInt(1000000),
}, buyer);
// SDK 自动使用 MultiKeyLock，需要买卖双方签名

// TimeLock + SingleKeyLock - 归属计划
const vestingResult = await marketService.createVesting({
  recipient: recipient.address,
  unlockTime: Math.floor(Date.now() / 1000) + 3600, // 1小时后解锁
}, wallet);
// SDK 自动组合 TimeLock 和 SingleKeyLock

// HeightLock + SingleKeyLock - 质押锁定
const stakeResult = await stakingService.stake({
  lockBlocks: 1000, // 锁定 1000 个区块
}, wallet);
// SDK 自动组合 HeightLock 和 SingleKeyLock
```

**关键理解**：
- SDK 根据业务场景自动选择合适的锁定条件
- 开发者无需直接操作锁定条件
- 通过 Service 方法的参数控制锁定行为（如 `lockBlocks`、`unlockTime`）

---

### 4. JSON-RPC API 封装

**WES 概念**：WES 节点提供 JSON-RPC 2.0 API，包括：
- `wes_getUTXO`：查询 UTXO
- `wes_buildTransaction`：构建交易
- `wes_computeSignatureHashFromDraft`：计算签名哈希
- `wes_finalizeTransactionFromDraft`：完成交易
- `wes_sendRawTransaction`：发送交易
- `wes_callContract`：调用合约
- 等等...

**SDK 视角**：

```typescript
// SDK 封装了 JSON-RPC 调用

// 1. 直接调用（底层）
const result = await client.call('wes_getUTXO', [addressBase58]);

// 2. 业务语义调用（推荐）
const balance = await tokenService.getBalance(address, tokenId);
// 内部调用 wes_getUTXO，解析并汇总余额

const transferResult = await tokenService.transfer({...}, wallet);
// 内部调用：
// - wes_getUTXO（查询输入 UTXO）
// - wes_buildTransaction（构建交易草稿）
// - wes_computeSignatureHashFromDraft（计算签名哈希）
// - wallet.signHash（签名）
// - wes_finalizeTransactionFromDraft（完成交易）
// - wes_sendRawTransaction（发送交易）
```

**关键理解**：
- SDK 封装了复杂的 JSON-RPC 调用流程
- 开发者可以使用业务语义接口（推荐）
- 也可以直接调用底层 API（高级用法）

---

### 5. 业务服务（Services）

**WES 概念**：WES 协议层提供基础能力，不定义业务语义。

**SDK 视角**：SDK 层将基础能力组合成业务语义：

```typescript
// Token Service - 代币操作
const tokenService = new TokenService(client, wallet);
await tokenService.transfer({...});
await tokenService.mint({...});
await tokenService.burn({...});

// Staking Service - 质押操作
const stakingService = new StakingService(client, wallet);
await stakingService.stake({...});
await stakingService.delegate({...});
await stakingService.claimReward({...});

// Market Service - 市场操作
const marketService = new MarketService(client, wallet);
await marketService.swapAMM({...});
await marketService.createEscrow({...});

// Governance Service - 治理操作
const governanceService = new GovernanceService(client, wallet);
await governanceService.propose({...});
await governanceService.vote({...});

// Resource Service - 资源操作
const resourceService = new ResourceService(client, wallet);
await resourceService.deployContract({...});
await resourceService.deployAIModel({...});
```

**关键理解**：
- 每个 Service 对应一个业务领域
- Service 方法封装了完整的交易构建和提交流程
- 开发者只需关注业务参数，无需了解底层实现

---

## 🏗️ SDK 架构概览

### 分层架构

```
┌─────────────────────────────────────────┐
│        应用层 (DApp/后端服务)              │
│  - 钱包应用                               │
│  - DApp 前端                              │
│  - 后端服务                               │
└─────────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────────┐
│      业务服务层 (services/)               │
│  - TokenService                          │
│  - StakingService                        │
│  - MarketService                         │
│  - GovernanceService                    │
│  - ResourceService                       │
└─────────────────────────────────────────┘
              ↓ 使用
┌─────────────────────────────────────────┐
│      核心客户端层 (client/)               │
│  - HTTPClient                            │
│  - WebSocketClient                       │
└─────────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────────┐
│      钱包层 (wallet/)                     │
│  - Wallet                                │
│  - Keystore                              │
└─────────────────────────────────────────┘
              ↓ JSON-RPC
┌─────────────────────────────────────────┐
│            WES 节点                      │
│  - JSON-RPC API                          │
│  - 交易执行                               │
│  - 状态管理                               │
└─────────────────────────────────────────┘
```

### 模块职责

| 模块 | 职责 | 依赖 |
|------|------|------|
| **client/** | 节点连接、JSON-RPC 调用、重试机制 | 无 |
| **wallet/** | 密钥管理、交易签名、地址派生 | 无 |
| **services/** | 业务语义实现、交易构建 | client, wallet |
| **utils/** | 工具函数（地址转换、批量操作、大文件处理） | 无 |

---

## 🔄 交易流程

### 完整交易流程（SDK 视角）

```typescript
// 1. 应用层调用业务方法
const result = await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000000),
  tokenId: null,
}, wallet);

// SDK 内部流程：
// 2. 查询 UTXO（client.call('wes_getUTXO')）
// 3. 构建交易草稿（DraftJSON）
// 4. 调用节点 API（client.call('wes_buildTransaction')）
// 5. 获取未签名交易（unsignedTx）
// 6. Wallet 签名（wallet.signHash()）
// 7. 完成交易（client.call('wes_finalizeTransactionFromDraft')）
// 8. 提交交易（client.call('wes_sendRawTransaction')）
// 9. 返回交易哈希（txHash）
```

---

## 🌐 环境支持

### Node.js 环境

```typescript
// 完整功能支持
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

// 所有功能可用
```

### 浏览器环境

```typescript
// 完整功能支持（使用异步 API）
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'https://node.weisyn.io',
  protocol: 'http',
});

// 注意：浏览器环境需要使用异步地址转换函数
// 详见：浏览器兼容性文档
```

**关键差异**：
- 加密函数：浏览器使用 Web Crypto API（异步），Node.js 使用 crypto 模块（同步）
- 文件读取：浏览器需要传入 `Uint8Array`，Node.js 可以传入文件路径
- 地址转换：浏览器需要使用 `*Async` 系列函数

---

## 📚 下一步

- **[快速开始](./getting-started.md)** - 安装和第一个示例
- **[架构设计](./architecture.md)** - 深入了解 SDK 架构
- **[业务指南](./guides/)** - 按业务场景学习使用

---

**最后更新**: 2025-11-17

