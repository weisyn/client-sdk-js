# Client SDK JS/TS - API 参考

**版本**: v1.0.0  


---

## 📋 文档定位

> 📌 **重要说明**：本文档提供 **JS/TS SDK API 的详细参考**。  
> 如需了解底层 JSON-RPC API 规范，请参考主仓库文档。

**本文档目标**：
- 提供完整的 API 接口说明
- 包含参数、返回值、使用示例
- 按模块组织（WESClient、业务服务、钱包等）

---

## 📚 API 概览

### WESClient 类型化 API

`WESClient` 提供类型化的 RPC 封装，是所有服务的基础：

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

### 业务服务 API

- [Token 服务](#token-服务)
- [Staking 服务](#staking-服务)
- [Market 服务](#market-服务)
- [Governance 服务](#governance-服务)
- [Resource 服务](#resource-服务)
- [Transaction 服务](#transaction-服务)
- [Event 服务](#event-服务)

---

## 🔧 详细 API 文档

### WESClient 类型化 API

#### listUTXOs

查询指定地址下的所有 UTXO。

```typescript
listUTXOs(address: Uint8Array): Promise<UTXO[]>
```

**参数**：
- `address: Uint8Array` - 地址（20 字节）

**返回值**：
- `Promise<UTXO[]>` - UTXO 列表

**示例**：

```typescript
const utxos = await wesClient.listUTXOs(address);

for (const utxo of utxos) {
  console.log(`UTXO: ${utxo.txId}:${utxo.outputIndex}, 金额: ${utxo.amount}`);
}
```

#### getResource

查询单个资源信息。

```typescript
getResource(resourceId: Uint8Array): Promise<ResourceInfo>
```

**参数**：
- `resourceId: Uint8Array` - 资源 ID（32 字节）

**返回值**：
- `Promise<ResourceInfo>` - 资源信息

**示例**：

```typescript
const resource = await wesClient.getResource(resourceId);
console.log(`资源类型: ${resource.resourceType}, 所有者: ${resource.owner}`);
```

#### getResources

查询资源列表（支持过滤）。

```typescript
getResources(filters: ResourceFilters): Promise<ResourceInfo[]>
```

**参数**：
- `filters: ResourceFilters` - 过滤条件

**ResourceFilters 接口**：

```typescript
interface ResourceFilters {
  resourceType?: ResourceType; // 资源类型（可选）
  owner?: Uint8Array;          // 所有者地址（可选）
  limit?: number;              // 限制数量
  offset?: number;             // 偏移量
}
```

**返回值**：
- `Promise<ResourceInfo[]>` - 资源列表

**示例**：

```typescript
const resources = await wesClient.getResources({
  resourceType: 'contract',
  limit: 20,
  offset: 0,
});
```

#### getTransaction

查询单个交易信息。

```typescript
getTransaction(txId: string): Promise<TransactionInfo>
```

**参数**：
- `txId: string` - 交易 ID

**返回值**：
- `Promise<TransactionInfo>` - 交易信息

#### getTransactionHistory

查询交易历史（支持过滤）。

```typescript
getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>
```

**参数**：
- `filters: TransactionFilters` - 过滤条件

**TransactionFilters 接口**：

```typescript
interface TransactionFilters {
  resourceId?: Uint8Array; // 资源 ID（可选）
  txId?: string;           // 交易 ID（可选）
  limit?: number;          // 限制数量
  offset?: number;        // 偏移量
}
```

**返回值**：
- `Promise<TransactionInfo[]>` - 交易列表

#### submitTransaction

提交已签名的交易。

```typescript
submitTransaction(tx: Transaction): Promise<SubmitTxResult>
```

**参数**：
- `tx: Transaction` - 已签名的交易

**返回值**：
- `Promise<SubmitTxResult>` - 提交结果（包含交易哈希）

#### getEvents

查询事件列表（支持过滤）。

```typescript
getEvents(filters: EventFilters): Promise<EventInfo[]>
```

**参数**：
- `filters: EventFilters` - 过滤条件

**EventFilters 接口**：

```typescript
interface EventFilters {
  resourceId?: Uint8Array; // 资源 ID（可选）
  eventName?: string;      // 事件名称（可选）
  limit?: number;         // 限制数量
  offset?: number;        // 偏移量
}
```

**返回值**：
- `Promise<EventInfo[]>` - 事件列表

#### subscribeEvents

订阅事件（WebSocket）。

```typescript
subscribeEvents(filters: EventFilters): Promise<EventStream>
```

**参数**：
- `filters: EventFilters` - 过滤条件

**返回值**：
- `Promise<EventStream>` - 事件流

**示例**：

```typescript
const subscription = await wesClient.subscribeEvents({
  resourceId: resourceId,
  eventName: eventName,
});

subscription.on('event', (event) => {
  console.log(`收到事件: ${event.topic}, 数据: ${event.data}`);
});
```

#### getNodeInfo

获取节点信息。

```typescript
getNodeInfo(): Promise<NodeInfo>
```

**返回值**：
- `Promise<NodeInfo>` - 节点信息

**NodeInfo 接口**：

```typescript
interface NodeInfo {
  rpcVersion: string;
  chainId: string;
  blockHeight: number;
}
```

---

### Token 服务

#### transfer

单笔转账。

```typescript
transfer(request: TransferRequest): Promise<TransferResult>
```

**TransferRequest 接口**：

```typescript
interface TransferRequest {
  from: Uint8Array;   // 发送方地址
  to: Uint8Array;     // 接收方地址
  amount: number;     // 金额
  tokenId: Uint8Array | null; // 代币 ID（null 表示原生币）
}
```

**返回值**：
- `Promise<TransferResult>` - 转账结果（包含交易哈希）

#### batchTransfer

批量转账（所有转账必须使用同一个 tokenID）。

```typescript
batchTransfer(request: BatchTransferRequest): Promise<BatchTransferResult>
```

**BatchTransferRequest 接口**：

```typescript
interface BatchTransferRequest {
  from: Uint8Array;      // 发送方地址
  transfers: TransferItem[]; // 转账列表
}

interface TransferItem {
  to: Uint8Array;       // 接收方地址
  amount: number;       // 金额
  tokenId: Uint8Array;  // 代币 ID（必须相同）
}
```

#### mint

代币铸造。

```typescript
mint(request: MintRequest): Promise<MintResult>
```

**MintRequest 接口**：

```typescript
interface MintRequest {
  to: Uint8Array;          // 接收方地址
  amount: number;          // 金额
  tokenId: Uint8Array;     // 代币 ID
  contractAddr: Uint8Array; // 合约地址
}
```

#### burn

代币销毁。

```typescript
burn(request: BurnRequest): Promise<BurnResult>
```

**BurnRequest 接口**：

```typescript
interface BurnRequest {
  from: Uint8Array;    // 发送方地址
  amount: number;       // 金额
  tokenId: Uint8Array;  // 代币 ID
}
```

#### getBalance

查询余额。

```typescript
getBalance(address: Uint8Array, tokenId: Uint8Array | null): Promise<number>
```

**参数**：
- `address: Uint8Array` - 地址
- `tokenId: Uint8Array | null` - 代币 ID（null 表示原生币）

**返回值**：
- `Promise<number>` - 余额

---

### Staking 服务

#### stake

质押代币。

```typescript
stake(request: StakeRequest): Promise<StakeResult>
```

**StakeRequest 接口**：

```typescript
interface StakeRequest {
  from: Uint8Array;     // 质押方地址
  amount: number;       // 金额
  validator: Uint8Array; // 验证者地址
}
```

#### unstake

解除质押。

```typescript
unstake(request: UnstakeRequest): Promise<UnstakeResult>
```

#### delegate

委托验证者。

```typescript
delegate(request: DelegateRequest): Promise<DelegateResult>
```

#### undelegate

取消委托。

```typescript
undelegate(request: UndelegateRequest): Promise<UndelegateResult>
```

#### claimReward

领取奖励。

```typescript
claimReward(request: ClaimRewardRequest): Promise<ClaimRewardResult>
```

---

### Market 服务

#### swapAMM

AMM 代币交换。

```typescript
swapAMM(request: SwapAMMRequest): Promise<SwapAMMResult>
```

**SwapAMMRequest 接口**：

```typescript
interface SwapAMMRequest {
  contractAddr: Uint8Array; // AMM 合约地址
  tokenIn: Uint8Array;      // 输入代币 ID
  amountIn: number;         // 输入金额
  tokenOut: Uint8Array;     // 输出代币 ID
  minAmountOut: number;     // 最小输出金额（滑点保护）
}
```

#### addLiquidity

添加流动性。

```typescript
addLiquidity(request: AddLiquidityRequest): Promise<AddLiquidityResult>
```

#### removeLiquidity

移除流动性。

```typescript
removeLiquidity(request: RemoveLiquidityRequest): Promise<RemoveLiquidityResult>
```

#### createVesting

创建归属计划。

```typescript
createVesting(request: CreateVestingRequest): Promise<CreateVestingResult>
```

#### createEscrow

创建托管。

```typescript
createEscrow(request: CreateEscrowRequest): Promise<CreateEscrowResult>
```

---

### Governance 服务

#### propose

创建提案。

```typescript
propose(request: ProposeRequest): Promise<ProposeResult>
```

**ProposeRequest 接口**：

```typescript
interface ProposeRequest {
  title: string;        // 提案标题
  content: string;      // 提案内容
  type: ProposalType;   // 提案类型
}
```

#### vote

投票。

```typescript
vote(request: VoteRequest): Promise<VoteResult>
```

**VoteRequest 接口**：

```typescript
interface VoteRequest {
  proposalId: string;  // 提案 ID
  support: boolean;    // true = 支持, false = 反对
}
```

#### updateParam

更新参数。

```typescript
updateParam(request: UpdateParamRequest): Promise<UpdateParamResult>
```

---

### Resource 服务

#### getResource

查询单个资源信息。

```typescript
getResource(resourceId: Uint8Array): Promise<ResourceInfo>
```

#### getResources

查询资源列表。

```typescript
getResources(filters: ResourceFilters): Promise<ResourceInfo[]>
```

#### deployContract

部署智能合约（支持锁定条件）。

```typescript
deployContract(request: DeployContractRequest, wallet?: Wallet): Promise<DeployContractResult>
```

**DeployContractRequest 接口**：

```typescript
interface DeployContractRequest {
  from: Uint8Array;              // 部署方地址
  wasmPath?: string;             // WASM 文件路径（可选）
  wasmContent: Uint8Array;       // WASM 文件内容
  contractName: string;          // 合约名称
  initArgs: Uint8Array;         // 初始化参数
  
  // ✅ 锁定条件列表（支持 7 种类型）
  lockingConditions?: LockingCondition[];
  
  // ✅ 锁定条件验证选项
  validateLockingConditions?: boolean; // 是否在SDK层验证（默认true）
  allowContractLockCycles?: boolean;  // 是否允许ContractLock循环（默认false）
}
```

**LockingCondition 接口**：

```typescript
interface LockingCondition {
  type: LockType;        // 锁定类型（SingleKey/MultiKey/Contract/Delegation/Threshold/Time/Height）
  keys?: Uint8Array[];   // 密钥列表（SingleKey/MultiKey）
  // ... 其他字段根据类型不同
}
```

#### deployAIModel

部署 AI 模型。

```typescript
deployAIModel(request: DeployAIModelRequest, wallet?: Wallet): Promise<DeployAIModelResult>
```

#### deployStaticResource

部署静态资源。

```typescript
deployStaticResource(request: DeployStaticResourceRequest, wallet?: Wallet): Promise<DeployStaticResourceResult>
```

---

### Transaction 服务

#### getTransaction

查询单个交易信息。

```typescript
getTransaction(txId: string): Promise<TransactionInfo>
```

#### getTransactionHistory

查询交易历史。

```typescript
getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>
```

#### submitTransaction

提交交易。

```typescript
submitTransaction(tx: Transaction, wallet?: Wallet): Promise<SubmitTxResult>
```

---

### Event 服务

#### getEvents

查询事件列表。

```typescript
getEvents(filters: EventFilters): Promise<EventInfo[]>
```

#### subscribeEvents

订阅事件。

```typescript
subscribeEvents(filters: EventFilters): Promise<EventStream>
```

---

### Wallet 功能

#### create

创建新钱包。

```typescript
static create(): Wallet
```

#### fromPrivateKey

从私钥创建钱包。

```typescript
static fromPrivateKey(privateKeyHex: string): Wallet
```

#### loadFromKeystore

从 Keystore 加载钱包。

```typescript
static loadFromKeystore(keystorePath: string, password: string): Promise<Wallet>
```

#### address

获取地址。

```typescript
get address(): Uint8Array
```

#### signTransaction

签名交易。

```typescript
signTransaction(unsignedTxBytes: Uint8Array): Promise<Uint8Array>
```

#### signMessage

签名消息。

```typescript
signMessage(messageBytes: Uint8Array): Promise<Uint8Array>
```

---

## 🔗 相关文档

- [开发者指南](./DEVELOPER_GUIDE.md) - 如何使用 API
- [业务场景实现指南](./BUSINESS_SCENARIOS.md) - API 使用示例
- [JSON-RPC API 规范](../../../weisyn.git/docs/reference/json-rpc/) - 底层 API 规范（主仓库）
- [Client API 设计](../_dev/CLIENT_API_DESIGN.md) - WESClient API 详细设计
- [Services 设计](../_dev/SERVICES_DESIGN.md) - 服务层详细设计

---

  
**维护者**: WES Core Team
