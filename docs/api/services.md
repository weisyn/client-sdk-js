# Services API 参考

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：draft
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK

---

## 📖 概述

Services 提供业务语义接口，封装了完整的交易构建和提交流程。开发者只需关注业务参数，无需了解底层实现。

---

## 🔗 关联文档

- **业务指南**：[业务使用指南](../guides/)
- **底层 API**：[WES JSON-RPC API 参考](https://github.com/weisyn/weisyn/blob/main/docs/reference/api.md)

---

## 📦 导入

```typescript
import {
  TokenService,
  StakingService,
  MarketService,
  GovernanceService,
  ResourceService,
} from '@weisyn/client-sdk-js';
```

---

## 🏗️ 服务概览

| 服务 | 职责 | 主要方法 |
|------|------|---------|
| **TokenService** | 代币操作 | `transfer`, `batchTransfer`, `mint`, `burn`, `getBalance` |
| **StakingService** | 质押操作 | `stake`, `unstake`, `delegate`, `undelegate`, `claimReward` |
| **MarketService** | 市场操作 | `swapAMM`, `addLiquidity`, `removeLiquidity`, `createEscrow`, `createVesting` |
| **GovernanceService** | 治理操作 | `propose`, `vote`, `updateParam` |
| **ResourceService** | 资源操作 | `deployContract`, `deployAIModel`, `deployStaticResource`, `getResource` |

---

## 💰 Token Service

### 创建服务

```typescript
const tokenService = new TokenService(client, wallet);
```

### transfer() - 转账

```typescript
async transfer(
  request: TransferRequest,
  wallet?: Wallet
): Promise<TransferResult>
```

**参数**：
- `request.from`: 发送方地址（20 字节）
- `request.to`: 接收方地址（20 字节）
- `request.amount`: 金额（`bigint` 或 `number`）
- `request.tokenId`: 代币 ID（32 字节，`null` 表示原生币）

**返回**：
- `txHash`: 交易哈希
- `success`: 是否成功

**示例**：
```typescript
const result = await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000000),
  tokenId: null, // 原生币
}, wallet);
```

**关联 JSON-RPC**：
- `wes_getUTXO` - 查询输入 UTXO
- `wes_buildTransaction` - 构建交易
- `wes_sendRawTransaction` - 发送交易

---

### batchTransfer() - 批量转账

```typescript
async batchTransfer(
  request: BatchTransferRequest,
  wallet?: Wallet
): Promise<BatchTransferResult>
```

**参数**：
- `request.from`: 发送方地址
- `request.transfers`: 转账列表（所有转账必须使用同一个 `tokenId`）
  - `to`: 接收方地址
  - `amount`: 金额
- `request.tokenId`: 代币 ID（所有转账共享）

**示例**：
```typescript
const result = await tokenService.batchTransfer({
  from: wallet.address,
  transfers: [
    { to: addr1, amount: BigInt(100000) },
    { to: addr2, amount: BigInt(200000) },
  ],
  tokenId: tokenId, // 所有转账使用同一个 tokenId
}, wallet);
```

---

### mint() - 代币铸造

```typescript
async mint(
  request: MintRequest,
  wallet?: Wallet
): Promise<MintResult>
```

**参数**：
- `request.to`: 接收方地址
- `request.amount`: 铸造数量
- `request.tokenId`: 代币 ID
- `request.contractAddr`: 合约地址（代币合约）

**关联 JSON-RPC**：
- `wes_callContract` - 调用代币合约的 `mint` 方法

---

### burn() - 代币销毁

```typescript
async burn(
  request: BurnRequest,
  wallet?: Wallet
): Promise<BurnResult>
```

**参数**：
- `request.from`: 销毁方地址
- `request.amount`: 销毁数量
- `request.tokenId`: 代币 ID
- `request.contractAddr`: 合约地址（代币合约）

---

### getBalance() - 查询余额

```typescript
async getBalance(
  address: Uint8Array,
  tokenId: Uint8Array | null
): Promise<bigint>
```

**参数**：
- `address`: 地址（20 字节）
- `tokenId`: 代币 ID（`null` 表示原生币）

**返回**：`Promise<bigint>` - 余额

**示例**：
```typescript
// 查询原生币余额
const balance = await tokenService.getBalance(wallet.address, null);

// 查询代币余额
const tokenBalance = await tokenService.getBalance(wallet.address, tokenId);
```

**关联 JSON-RPC**：
- `wes_getUTXO` - 查询 UTXO 并汇总余额

---

## 🏛️ Staking Service

### stake() - 质押

```typescript
async stake(
  request: StakeRequest,
  wallet?: Wallet
): Promise<StakeResult>
```

**参数**：
- `request.from`: 质押者地址
- `request.validatorAddr`: 验证者地址
- `request.amount`: 质押金额
- `request.lockBlocks`: 锁定期（区块数，可选）

**返回**：
- `txHash`: 交易哈希
- `stakeId`: 质押 ID（用于后续操作）

**关联 JSON-RPC**：
- `wes_buildTransaction` - 构建质押交易（使用 ContractLock + HeightLock）

---

### unstake() - 解质押

```typescript
async unstake(
  request: UnstakeRequest,
  wallet?: Wallet
): Promise<UnstakeResult>
```

**参数**：
- `request.from`: 质押者地址
- `request.stakeId`: 质押 ID

**返回**：
- `txHash`: 交易哈希
- `amount`: 解质押金额
- `reward`: 奖励金额

---

### delegate() - 委托

```typescript
async delegate(
  request: DelegateRequest,
  wallet?: Wallet
): Promise<DelegateResult>
```

**参数**：
- `request.from`: 委托者地址
- `request.validatorAddr`: 验证者地址
- `request.amount`: 委托金额

**返回**：
- `txHash`: 交易哈希
- `delegateId`: 委托 ID

---

### claimReward() - 领取奖励

```typescript
async claimReward(
  request: ClaimRewardRequest,
  wallet?: Wallet
): Promise<ClaimRewardResult>
```

**参数**：
- `request.from`: 质押者/委托者地址
- `request.stakeId`: 质押 ID（可选）
- `request.delegateId`: 委托 ID（可选）

**返回**：
- `txHash`: 交易哈希
- `reward`: 奖励金额

---

## 🏪 Market Service

### swapAMM() - AMM 代币交换

```typescript
async swapAMM(
  request: SwapAMMRequest,
  wallet?: Wallet
): Promise<SwapAMMResult>
```

**参数**：
- `request.from`: 交换者地址
- `request.contractAddr`: AMM 合约地址
- `request.tokenIdIn`: 输入代币 ID
- `request.amountIn`: 输入金额
- `request.tokenIdOut`: 输出代币 ID
- `request.amountOutMin`: 最小输出金额（滑点保护）

**关联 JSON-RPC**：
- `wes_callContract` - 调用 AMM 合约的 `swap` 方法

---

### createEscrow() - 创建托管

```typescript
async createEscrow(
  request: CreateEscrowRequest,
  wallet?: Wallet
): Promise<CreateEscrowResult>
```

**参数**：
- `request.from`: 买方地址
- `request.seller`: 卖方地址
- `request.amount`: 托管金额
- `request.tokenId`: 代币 ID（`null` 表示原生币）

**返回**：
- `txHash`: 交易哈希
- `escrowId`: 托管 ID

**关联 JSON-RPC**：
- `wes_buildTransaction` - 构建托管交易（使用 MultiKeyLock）

---

### createVesting() - 创建归属计划

```typescript
async createVesting(
  request: CreateVestingRequest,
  wallet?: Wallet
): Promise<CreateVestingResult>
```

**参数**：
- `request.from`: 创建者地址
- `request.recipient`: 接收者地址
- `request.amount`: 总金额
- `request.tokenId`: 代币 ID
- `request.unlockTime`: 解锁时间（Unix 时间戳）

**关联 JSON-RPC**：
- `wes_buildTransaction` - 构建归属交易（使用 TimeLock + SingleKeyLock）

---

## 🗳️ Governance Service

### propose() - 创建提案

```typescript
async propose(
  request: ProposeRequest,
  wallet?: Wallet
): Promise<ProposeResult>
```

**参数**：
- `request.proposer`: 提案者地址
- `request.proposalData`: 提案数据
  - `title`: 提案标题
  - `description`: 提案描述
  - `action`: 提案类型
  - `params`: 提案参数

**返回**：
- `txHash`: 交易哈希
- `proposalId`: 提案 ID（stateID）

**关联 JSON-RPC**：
- `wes_buildTransaction` - 构建提案交易（使用 StateOutput）

---

### vote() - 投票

```typescript
async vote(
  request: VoteRequest,
  wallet?: Wallet
): Promise<VoteResult>
```

**参数**：
- `request.voter`: 投票者地址
- `request.proposalId`: 提案 ID
- `request.choice`: 投票选择（1=支持, 0=反对, -1=弃权）
- `request.weight`: 投票权重

**返回**：
- `txHash`: 交易哈希
- `voteId`: 投票 ID

---

## 📦 Resource Service

### deployContract() - 部署智能合约

```typescript
async deployContract(
  request: DeployContractRequest,
  wallet?: Wallet
): Promise<DeployContractResult>
```

**参数**：
- `request.from`: 部署者地址
- `request.wasmBytes`: WASM 字节码（`Uint8Array`）
- `request.name`: 合约名称（可选）
- `request.description`: 合约描述（可选）

**返回**：
- `txHash`: 交易哈希
- `contractId`: 合约 ID（资源哈希）

**关联 JSON-RPC**：
- `wes_deployResource` - 部署资源

---

### deployAIModel() - 部署 AI 模型

```typescript
async deployAIModel(
  request: DeployAIModelRequest,
  wallet?: Wallet
): Promise<DeployAIModelResult>
```

**参数**：
- `request.from`: 部署者地址
- `request.modelBytes`: ONNX 模型字节码（`Uint8Array`）
- `request.name`: 模型名称（可选）
- `request.framework`: 框架（如 'ONNX'）

**关联 JSON-RPC**：
- `wes_deployResource` - 部署资源

---

### deployStaticResource() - 部署静态资源

```typescript
async deployStaticResource(
  request: DeployStaticResourceRequest,
  wallet?: Wallet
): Promise<DeployStaticResourceResult>
```

**参数**：
- `request.from`: 部署者地址
- `request.fileContent`: 文件内容（`Uint8Array`）
- `request.mimeType`: MIME 类型（如 'image/png'）

**注意**：
- Node.js 环境：可以传入文件路径（SDK 会自动读取）
- 浏览器环境：必须传入 `Uint8Array`

---

### getResource() - 查询资源

```typescript
async getResource(
  resourceId: Uint8Array
): Promise<ResourceInfo>
```

**参数**：
- `resourceId`: 资源 ID（32 字节哈希）

**返回**：
- `resourceId`: 资源 ID
- `type`: 资源类型（'contract' | 'model' | 'static'）
- `size`: 资源大小（字节）
- `mimeType`: MIME 类型（静态资源）

**注意**：此方法不需要 Wallet

---

## 🔗 相关文档

- **[Token 指南](../guides/token.md)** - Token 服务详细指南
- **[Staking 指南](../guides/staking.md)** - Staking 服务详细指南
- **[Market 指南](../guides/market.md)** - Market 服务详细指南
- **[Governance 指南](../guides/governance.md)** - Governance 服务详细指南
- **[Resource 指南](../guides/resource.md)** - Resource 服务详细指南

---

**最后更新**: 2025-11-17

