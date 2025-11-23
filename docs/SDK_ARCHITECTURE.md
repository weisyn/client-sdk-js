# Client SDK JS/TS - SDK 内部架构

**版本**: v1.0.0  
**最后更新**: 2025-01-23

---

## 📋 文档定位

> 📌 **重要说明**：本文档聚焦 **SDK 内部分层架构设计**。  
> 如需了解 WES 平台的整体架构，请参考主仓库文档。

**本文档目标**：
- 说明 SDK 内部分层架构（L1/L2/L3）
- 解释模块组织方式和依赖关系
- 记录设计决策

---

## 🏗️ 分层架构

### 整体分层图

```mermaid
graph TB
    subgraph "L3: 业务服务层（业务开发者使用）"
        BUSINESS[services/<br/>业务语义封装<br/>Token/Staking/Market等]
        BUSINESS --> TOKEN[token/<br/>转账/铸造/销毁]
        BUSINESS --> STAKING[staking/<br/>质押/解质押]
        BUSINESS --> MARKET[market/<br/>托管/释放]
        BUSINESS --> GOV[governance/<br/>提案/投票]
        BUSINESS --> RESOURCE_DEPLOY[resource/<br/>资源部署]
    end
    
    subgraph "L2: 中层服务层（Explorer 场景）"
        MIDDLE[services/<br/>Resource/Transaction/Event]
        MIDDLE --> RESOURCE_SVC[resource/<br/>资源查询]
        MIDDLE --> TX_SVC[transaction/<br/>交易查询]
        MIDDLE --> EVENT_SVC[event/<br/>事件订阅]
    end
    
    subgraph "L1: 底层客户端（RPC 封装）"
        CLIENT[client/<br/>WESClient]
        CLIENT --> HTTP[HTTP Client]
        CLIENT --> WS[WebSocket Client]
    end
    
    subgraph "钱包层（独立）"
        WALLET[wallet/<br/>Wallet/Keystore]
    end
    
    BUSINESS --> MIDDLE
    MIDDLE --> CLIENT
    CLIENT --> NODE[WES 节点]
    BUSINESS -.签名.-> WALLET
    MIDDLE -.签名.-> WALLET
    
    style BUSINESS fill:#FF9800,color:#fff
    style MIDDLE fill:#4CAF50,color:#fff
    style CLIENT fill:#2196F3,color:#fff
    style WALLET fill:#FFC107,color:#000
    style NODE fill:#9E9E9E,color:#fff
```

### 层级职责

| 层级 | 目录 | 职责 | 使用者 |
|------|------|------|--------|
| **L3: 业务服务** | `services/token`、`services/staking`、`services/market`、`services/governance` | 业务语义封装（Transfer、Mint、Stake、Vote等） | 业务开发者 |
| **L2: 中层服务** | `services/resource`、`services/transaction`、`services/event` | Explorer 场景服务（资源查询、交易历史、事件订阅） | Workbench、Explorer 工具 |
| **L1: 底层客户端** | `client/` | WESClient RPC 封装、类型化 API | 所有 Service |
| **钱包层** | `wallet/` | 密钥管理、交易签名 | 所有 Service |

---

## 📦 模块结构

### 目录结构

```
client-sdk-js/
├── src/
│   ├── client/                  # L1: 底层客户端
│   │   ├── client.ts            # WESClient 接口定义
│   │   ├── config.ts            # 配置
│   │   ├── http.ts              # HTTP 客户端实现
│   │   ├── websocket.ts         # WebSocket 客户端实现
│   │   ├── errors.ts            # 错误定义
│   │   ├── retry.ts             # 重试机制
│   │   └── types.ts             # 核心类型定义
│   │
│   ├── services/                # L2/L3: 服务层
│   │   ├── resource/            # L2: 资源服务
│   │   │   ├── service.ts
│   │   │   ├── query.ts
│   │   │   └── deploy.ts
│   │   ├── transaction/         # L2: 交易服务
│   │   │   ├── service.ts
│   │   │   ├── query.ts
│   │   │   └── history.ts
│   │   ├── event/               # L2: 事件服务
│   │   │   ├── service.ts
│   │   │   ├── query.ts
│   │   │   └── subscribe.ts
│   │   ├── token/               # L3: Token 服务
│   │   ├── staking/             # L3: Staking 服务
│   │   ├── market/              # L3: Market 服务
│   │   └── governance/          # L3: Governance 服务
│   │
│   ├── utils/                   # 工具函数
│   │   ├── address.ts           # 地址转换（同步/异步）
│   │   ├── batch.ts             # 批量操作
│   │   └── file.ts              # 文件处理
│   │
│   ├── wallet/                  # 钱包层（独立）
│   │   ├── wallet.ts            # Wallet 接口和实现
│   │   └── keystore.ts          # Keystore 管理器
│   │
│   ├── types.ts                 # 核心类型定义
│   └── index.ts                 # 统一导出
│
├── mock/                        # Mock 包
│   ├── client.ts                # WESClientMock
│   └── index.ts
│
├── docs/                        # 用户文档
└── _dev/                        # 开发文档
```

---

## 🔧 核心组件

### 1. WESClient (L1)

**职责**：
- 封装所有 RPC 调用，提供类型化方法
- 处理重试、超时、错误转换
- 支持 HTTP/WebSocket 两种协议（浏览器环境不支持 gRPC）

**接口定义**：

```typescript
interface WESClient {
    // UTXO 操作
    listUTXOs(address: Uint8Array): Promise<UTXO[]>;
    
    // 资源操作
    getResource(resourceId: Uint8Array): Promise<ResourceInfo>;
    getResources(filters: ResourceFilters): Promise<ResourceInfo[]>;
    
    // 交易操作
    getTransaction(txId: string): Promise<TransactionInfo>;
    getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>;
    submitTransaction(tx: Transaction): Promise<SubmitTxResult>;
    
    // 事件操作
    getEvents(filters: EventFilters): Promise<EventInfo[]>;
    subscribeEvents(filters: EventFilters): Promise<EventStream>;
    
    // 节点信息
    getNodeInfo(): Promise<NodeInfo>;
    
    // 连接管理
    close(): void;
}
```

### 2. Resource Service (L2)

**职责**：
- 资源查询（单个/列表）
- 资源部署（合约/模型/静态资源）
- 支持可执行资源锁定能力（7 种锁定条件）
- 为 Workbench Resource Explorer 提供数据

**接口定义**：

```typescript
interface ResourceService {
    // 查询
    getResource(resourceId: Uint8Array): Promise<ResourceInfo>;
    getResources(filters: ResourceFilters): Promise<ResourceInfo[]>;
    
    // 部署
    deployContract(request: DeployContractRequest, wallet?: Wallet): Promise<DeployContractResult>;
    deployAIModel(request: DeployAIModelRequest, wallet?: Wallet): Promise<DeployAIModelResult>;
    deployStaticResource(request: DeployStaticResourceRequest, wallet?: Wallet): Promise<DeployStaticResourceResult>;
}
```

### 3. Transaction Service (L2)

**职责**：
- 交易查询（单个/历史）
- 交易提交
- 为 Workbench History Tab 提供数据

**接口定义**：

```typescript
interface TransactionService {
    getTransaction(txId: string): Promise<TransactionInfo>;
    getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>;
    submitTransaction(tx: Transaction, wallet?: Wallet): Promise<SubmitTxResult>;
}
```

### 4. Event Service (L2)

**职责**：
- 事件查询
- 事件订阅（WebSocket）
- 为 Workbench Events Tab 提供数据

**接口定义**：

```typescript
interface EventService {
    getEvents(filters: EventFilters): Promise<EventInfo[]>;
    subscribeEvents(filters: EventFilters): Promise<EventStream>;
}
```

### 5. 业务服务 (L3)

**Token Service**：
- transfer：单笔转账
- batchTransfer：批量转账
- mint：代币铸造
- burn：代币销毁
- getBalance：余额查询

**Staking Service**：
- stake：质押
- unstake：解质押
- delegate：委托
- undelegate：取消委托
- claimReward：领取奖励

**Market Service**：
- swapAMM：AMM 代币交换
- addLiquidity：添加流动性
- removeLiquidity：移除流动性
- createVesting：创建归属计划
- createEscrow：创建托管

**Governance Service**：
- propose：创建提案
- vote：投票
- updateParam：更新参数

---

## 🔗 依赖关系

### 模块依赖

```
L3 业务服务 (token/staking/market/governance)
    ↓ 依赖
L2 中层服务 (resource/transaction/event)
    ↓ 依赖
L1 底层客户端 (client/WESClient)
    ↓ 依赖
WES 节点 (JSON-RPC/WebSocket)

钱包层 (wallet/)
    ↓ 独立模块，被所有 Service 使用
```

### 依赖规则

- ✅ **L3 → L2 → L1**：业务服务依赖中层服务，中层服务依赖底层客户端
- ✅ **钱包层独立**：钱包层不依赖其他模块，可独立使用
- ✅ **工具层独立**：utils 层不依赖其他模块，提供通用工具函数
- ❌ **禁止循环依赖**：任何模块都不能形成循环依赖

---

## 📊 数据流

### 查询流程

```mermaid
sequenceDiagram
    participant App as 应用层
    participant Service as Service 层 (L2/L3)
    participant Client as WESClient (L1)
    participant Node as WES 节点
    
    App->>Service: getResource(resourceId)
    Service->>Client: getResource(resourceId)
    Client->>Node: wes_getResource RPC
    Node-->>Client: ResourceInfo
    Client-->>Service: ResourceInfo
    Service-->>App: ResourceInfo
```

### 交易流程

```mermaid
sequenceDiagram
    participant App as 应用层
    participant Service as Service 层 (L3)
    participant Builder as TransactionBuilder
    participant Client as WESClient (L1)
    participant Wallet as Wallet
    participant Node as WES 节点
    
    App->>Service: transfer(...)
    Service->>Builder: buildTransaction(...)
    Builder->>Client: listUTXOs(...)
    Client->>Node: wes_getUTXO RPC
    Node-->>Client: UTXO[]
    Client-->>Builder: UTXO[]
    Builder->>Builder: 构造交易草稿
    Builder->>Client: wes_buildTransaction RPC
    Client->>Node: wes_buildTransaction RPC
    Node-->>Client: UnsignedTx
    Client-->>Builder: UnsignedTx
    Builder-->>Service: UnsignedTx
    Service->>Wallet: signTransaction(unsignedTx)
    Wallet-->>Service: SignedTx
    Service->>Client: submitTransaction(signedTx)
    Client->>Node: wes_sendRawTransaction RPC
    Node-->>Client: TxHash
    Client-->>Service: TxHash
    Service-->>App: TxHash
```

---

## 🎯 设计原则

### 1. 业务语义在 SDK 层

**核心架构理念**：WES 协议层提供基础能力，SDK 层实现业务语义。

- **WES 协议层**：提供固化的基础能力
  - 2种输入模式（AssetInput、ResourceInput）
  - 3种输出类型（AssetOutput、StateOutput、ResourceOutput）
  - 7种锁定条件（SingleKey、MultiKey、Contract、Delegation、Threshold、Time、Height）
  
- **SDK 层**：将基础能力组合成业务语义
  - 转账、质押、投票等业务操作 = 输入输出和锁定条件的组合
  - 所有业务语义都在 SDK 层实现，不依赖节点业务服务 API

### 2. 分层清晰

- **L1 层**：只负责 RPC 封装，不涉及业务逻辑
- **L2 层**：提供 Explorer 场景服务，不涉及具体业务语义
- **L3 层**：提供业务语义封装，组合 L1/L2 能力

### 3. 完全独立

- ✅ 不依赖任何 WES 内部包，可独立发布
- ✅ 通过 API（JSON-RPC/WebSocket）与节点交互
- ✅ 只依赖标准库和通用第三方库

### 4. 浏览器和 Node.js 支持

- **浏览器环境**：
  - 使用 Web Crypto API 进行加密操作
  - 不支持 gRPC（仅支持 HTTP 和 WebSocket）
  - 支持 ESM 和 UMD 格式
  - 支持 Tree Shaking

- **Node.js 环境**：
  - 使用 crypto 模块进行加密操作
  - 支持 HTTP 和 WebSocket
  - 支持 CJS 和 ESM 格式

---

## 🔒 可执行资源锁定能力

### 三层锁定模型

可执行资源（智能合约、AI模型等）的锁定能力分为三个层次：

1. **L1: 资源所有权锁定** (`ResourceOutput.locking_conditions`)
   - 决定：谁可以升级/销毁/转移合约资源
   - 适用：SingleKey / MultiKey / TimeLock / HeightLock / DelegationLock / ContractLock / ThresholdLock

2. **L2: 调用访问控制** (`TxInput + AssetOutput + ContractLock`)
   - 决定：谁可以在什么条件下调用合约
   - 适用：ContractLock + ExecutionProof / DelegationLock

3. **L3: 应用级权限** (合约内部逻辑)
   - 决定：调用后，合约内部的业务权限控制
   - 适用：onlyOwner / onlyRole / 自定义权限逻辑

### 7种锁定条件

| 锁定类型 | 适用L1（所有权） | 适用L2（调用控制） | 典型场景 |
|---------|----------------|-----------------|---------|
| SingleKeyLock | ✅ 基础模式 | ✅ 简单调用 | 个人合约、PoC |
| MultiKeyLock | ✅ 组织治理 | ✅ 多签调用 | DAO协议、企业合约 |
| ContractLock | ⚠️ 高级（需防循环） | ✅ 付费/动态控制 | 治理合约、付费模型 |
| DelegationLock | ✅ 临时授权 | ✅ 代理调用 | 平台托管、外包维护 |
| ThresholdLock | ✅ 银行级安全 | ✅ 高安全调用 | 央行合约、核心清算 |
| TimeLock | ✅ 时间窗口 | ✅ 定时调用 | 锁仓升级、定期发布 |
| HeightLock | ✅ 区块窗口 | ✅ 高度控制 | 分阶段升级、里程碑 |

> 📖 **详细设计**：参见 [可执行资源锁定能力设计](../../workbench/contract-workbench.git/_dev/EXECUTABLE_RESOURCE_LOCKING_DESIGN.md)

---

## 🔗 相关文档

- [应用场景分析](./APPLICATION_SCENARIOS_ANALYSIS.md) - SDK 职责边界
- [架构规划](./ARCHITECTURE_PLAN.md) - 未来演进方向
- [语言与环境限制](./LANGUAGE_AND_ENV_LIMITATIONS.md) - JS/TS 特有限制
- [WES 系统架构文档](../../../weisyn.git/docs/system/architecture/1-STRUCTURE_VIEW.md) - 平台架构（主仓库）
- [Client API 设计](../_dev/CLIENT_API_DESIGN.md) - WESClient API 详细设计
- [Services 设计](../_dev/SERVICES_DESIGN.md) - 服务层详细设计

---

**最后更新**: 2025-01-23  
**维护者**: WES Core Team
