# Governance 服务指南

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

Governance Service 提供治理相关功能，包括提案创建、投票和参数更新。

---

## 🔗 关联文档

- **API 参考**：[Services API - Governance](../api/services.md#-governance-service)
- **WES 协议**：[WES 治理机制](https://github.com/weisyn/weisyn/blob/main/docs/system/platforms/governance/README.md)（待确认）

---

## 🚀 快速开始

### 创建服务

```typescript
import { Client, GovernanceService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

const wallet = await Wallet.create();
const governanceService = new GovernanceService(client, wallet);
```

---

## 📝 创建提案

### 基本提案

```typescript
import { ProposalType } from '@weisyn/client-sdk-js';

const result = await governanceService.propose({
  from: wallet.address,
  title: '增加最小质押金额',
  content: '建议将最小质押金额从 1000 增加到 5000',
  type: ProposalType.ParameterChange,
  metadata: {
    param_key: 'min_stake_amount',
    param_value: '5000',
  },
}, wallet);

console.log(`提案创建成功！交易哈希: ${result.txHash}`);
console.log(`提案 ID: ${result.proposalId}`);
```

### 提案类型

```typescript
enum ProposalType {
  ParameterChange = 'ParameterChange',  // 参数变更
  ContractUpgrade = 'ContractUpgrade', // 合约升级
  ResourceDeployment = 'ResourceDeployment', // 资源部署
  Other = 'Other',                      // 其他
}
```

### 实现原理

SDK 内部使用 `StateOutput` 存储提案数据，`stateID` 由提案内容的 SHA256 哈希生成：

```typescript
// SDK 内部实现（简化）
const proposalData = {
  title: title,
  content: content,
  type: type,
  metadata: metadata,
};

const stateId = sha256(JSON.stringify(proposalData));
// stateId 就是 proposalId
```

---

## 🗳️ 投票

### 基本投票

```typescript
const result = await governanceService.vote({
  from: wallet.address,
  proposalId: proposalId, // 提案 ID
  support: true, // true = 支持, false = 反对
}, wallet);

console.log(`投票成功！交易哈希: ${result.txHash}`);
console.log(`投票 ID: ${result.voteId}`);
```

### 投票选择

```typescript
// 支持
const supportResult = await governanceService.vote({
  from: wallet.address,
  proposalId: proposalId,
  support: true,
}, wallet);

// 反对
const againstResult = await governanceService.vote({
  from: wallet.address,
  proposalId: proposalId,
  support: false,
}, wallet);
```

### 投票权重

```typescript
// 某些场景下，投票可能有权重（例如：按质押金额）
const result = await governanceService.vote({
  from: wallet.address,
  proposalId: proposalId,
  support: true,
  weight: BigInt(1000000), // 投票权重
}, wallet);
```

### 实现原理

投票也使用 `StateOutput` 存储，`stateID` 由投票数据生成：

```typescript
const voteData = {
  proposalId: proposalId,
  voter: voter.address,
  choice: support ? 1 : 0,
  weight: weight,
};

const stateId = sha256(JSON.stringify(voteData));
// stateId 就是 voteId
```

---

## ⚙️ 参数更新

### 更新治理参数

```typescript
const result = await governanceService.updateParam({
  from: wallet.address,
  key: 'min_stake_amount',
  value: '5000',
}, wallet);

console.log(`参数更新成功！交易哈希: ${result.txHash}`);
```

### 注意事项

- ⚠️ 参数更新通常需要治理提案通过后才能执行
- ✅ SDK 只负责提交参数更新交易，不负责验证治理权限
- ✅ 参数更新也使用 `StateOutput` 存储

---

## 🎯 典型场景

### 场景 1：完整的治理流程

```typescript
async function completeGovernanceFlow(
  proposer: Wallet,
  voter: Wallet
) {
  const proposerService = new GovernanceService(client, proposer);
  const voterService = new GovernanceService(client, voter);
  
  // 1. 创建提案
  const proposalResult = await proposerService.propose({
    from: proposer.address,
    title: '更新最小质押金额',
    content: '建议将最小质押金额从 1000 增加到 5000',
    type: ProposalType.ParameterChange,
    metadata: {
      param_key: 'min_stake_amount',
      param_value: '5000',
    },
  }, proposer);
  
  console.log(`提案 ID: ${proposalResult.proposalId}`);
  
  // 2. 投票
  const voteResult = await voterService.vote({
    from: voter.address,
    proposalId: proposalResult.proposalId!,
    support: true,
  }, voter);
  
  console.log(`投票 ID: ${voteResult.voteId}`);
  
  // 3. 等待投票期结束后，执行参数更新
  // ... 等待投票期结束 ...
  
  const updateResult = await proposerService.updateParam({
    from: proposer.address,
    key: 'min_stake_amount',
    value: '5000',
  }, proposer);
  
  console.log(`参数已更新`);
}
```

### 场景 2：批量投票

```typescript
async function batchVote(
  voter: Wallet,
  proposals: string[],
  support: boolean
) {
  const governanceService = new GovernanceService(client, voter);
  
  const results = await Promise.all(
    proposals.map(proposalId =>
      governanceService.vote({
        from: voter.address,
        proposalId: proposalId,
        support: support,
      }, voter)
    )
  );
  
  console.log(`批量投票完成，共 ${results.length} 票`);
  return results;
}
```

### 场景 3：查询提案状态

```typescript
// 注意：SDK 当前不提供查询提案状态的直接方法
// 需要通过 Client 调用底层 JSON-RPC 方法

async function getProposalStatus(proposalId: string) {
  // 查询 StateOutput（提案数据）
  const proposalData = await client.call('wes_getStateOutput', [proposalId]);
  
  // 查询投票数量（需要遍历所有投票 StateOutput）
  // 这里简化处理
  return {
    proposalId: proposalId,
    data: proposalData,
  };
}
```

---

## ⚠️ 常见错误

### 提案已存在

```typescript
try {
  await governanceService.propose({
    from: wallet.address,
    title: '重复提案',
    content: '...',
    type: ProposalType.ParameterChange,
    metadata: {},
  }, wallet);
} catch (error) {
  if (error.message.includes('proposal already exists')) {
    console.error('提案已存在');
  }
}
```

### 投票已存在

```typescript
try {
  await governanceService.vote({
    from: wallet.address,
    proposalId: proposalId,
    support: true,
  }, wallet);
} catch (error) {
  if (error.message.includes('vote already exists')) {
    console.error('已投票，不能重复投票');
  }
}
```

### 权限不足

```typescript
try {
  await governanceService.updateParam({
    from: wallet.address,
    key: 'min_stake_amount',
    value: '5000',
  }, wallet);
} catch (error) {
  if (error.message.includes('permission denied')) {
    console.error('权限不足，需要治理提案通过');
  }
}
```

---

## 🔗 相关文档

- **[API 参考](../api/services.md#-governance-service)** - 完整 API 文档
- **[Staking 指南](./staking.md)** - 质押服务指南
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

