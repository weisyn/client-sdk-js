# Staking 服务指南

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

Staking Service 提供质押相关功能，包括质押、解质押、委托、取消委托和奖励领取。

---

## 🔗 关联文档

- **API 参考**：[Services API - Staking](../api/services.md#-staking-service)
- **WES 协议**：[WES 质押机制](https://github.com/weisyn/weisyn/blob/main/docs/system/platforms/staking/README.md)（待确认）

---

## 🚀 快速开始

### 创建服务

```typescript
import { Client, StakingService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

const wallet = await Wallet.create();
const stakingService = new StakingService(client, wallet);
```

---

## 💎 质押

### 基本质押

```typescript
const validatorWallet = await Wallet.create();

const result = await stakingService.stake({
  from: wallet.address,
  validatorAddr: validatorWallet.address,
  amount: BigInt(1000000), // 1 WES
}, wallet);

console.log(`质押成功！交易哈希: ${result.txHash}`);
console.log(`质押 ID: ${result.stakeId}`);
```

### 带锁定期的质押

```typescript
const result = await stakingService.stake({
  from: wallet.address,
  validatorAddr: validatorWallet.address,
  amount: BigInt(1000000),
  lockBlocks: 1000, // 锁定 1000 个区块
}, wallet);
```

### 实现原理

SDK 内部：
1. 构建交易草稿，使用 `ContractLock` + `HeightLock`（如果指定了 `lockBlocks`）
2. 调用 `wes_buildTransaction` 构建交易
3. 签名并提交交易
4. 从交易输出中提取 `stakeId`

---

## 🔓 解质押

### 解质押

```typescript
const result = await stakingService.unstake({
  from: wallet.address,
  stakeId: stakeId, // 之前质押时获得的 stakeId
}, wallet);

console.log(`解质押成功！交易哈希: ${result.txHash}`);
console.log(`解质押金额: ${result.amount}`);
console.log(`奖励金额: ${result.reward}`);
```

### 注意事项

- ⚠️ 需要满足锁定条件（如 `lockBlocks` 已过期）
- ✅ SDK 自动计算解质押金额和奖励金额
- ✅ 解质押后，资金会返回到钱包

---

## 👥 委托

### 基本委托

```typescript
const result = await stakingService.delegate({
  from: wallet.address,
  validatorAddr: validatorWallet.address,
  amount: BigInt(500000), // 0.5 WES
}, wallet);

console.log(`委托成功！交易哈希: ${result.txHash}`);
console.log(`委托 ID: ${result.delegateId}`);
```

### 永不过期委托

```typescript
// 不指定 lockBlocks，表示永不过期
const result = await stakingService.delegate({
  from: wallet.address,
  validatorAddr: validatorWallet.address,
  amount: BigInt(500000),
}, wallet);
```

### 实现原理

SDK 内部使用 `DelegationLock` 锁定条件，表示资金委托给验证者。

---

## ❌ 取消委托

### 取消委托

```typescript
const result = await stakingService.undelegate({
  from: wallet.address,
  delegateId: delegateId, // 之前委托时获得的 delegateId
}, wallet);

console.log(`取消委托成功！交易哈希: ${result.txHash}`);
```

### 部分取消委托

```typescript
// 如果有多笔委托，可以部分取消
const result = await stakingService.undelegate({
  from: wallet.address,
  delegateId: delegateId,
  amount: BigInt(200000), // 只取消部分金额
}, wallet);
```

---

## 🎁 领取奖励

### 通过 StakeID 领取

```typescript
const result = await stakingService.claimReward({
  from: wallet.address,
  stakeId: stakeId, // 质押 ID
}, wallet);

console.log(`领取奖励成功！交易哈希: ${result.txHash}`);
console.log(`奖励金额: ${result.reward}`);
```

### 通过 DelegateID 领取

```typescript
const result = await stakingService.claimReward({
  from: wallet.address,
  delegateId: delegateId, // 委托 ID
}, wallet);
```

### 注意事项

- ⚠️ 如果没有奖励，方法可能会失败
- ✅ SDK 自动查询奖励金额
- ✅ 奖励会直接转入钱包

---

## 🎯 典型场景

### 场景 1：完整质押流程

```typescript
async function completeStakingFlow(
  stakerWallet: Wallet,
  validatorAddr: Uint8Array
) {
  const stakingService = new StakingService(client, stakerWallet);
  
  // 1. 质押
  const stakeResult = await stakingService.stake({
    from: stakerWallet.address,
    validatorAddr: validatorAddr,
    amount: BigInt(1000000),
    lockBlocks: 1000,
  }, stakerWallet);
  
  console.log(`质押 ID: ${stakeResult.stakeId}`);
  
  // 2. 等待一段时间后领取奖励
  // ... 等待区块生成 ...
  
  try {
    const claimResult = await stakingService.claimReward({
      from: stakerWallet.address,
      stakeId: stakeResult.stakeId!,
    }, stakerWallet);
    
    console.log(`奖励: ${claimResult.reward}`);
  } catch (error) {
    console.log('暂无奖励');
  }
  
  // 3. 解质押
  const unstakeResult = await stakingService.unstake({
    from: stakerWallet.address,
    stakeId: stakeResult.stakeId!,
  }, stakerWallet);
  
  console.log(`解质押金额: ${unstakeResult.amount}`);
}
```

### 场景 2：委托给多个验证者

```typescript
async function delegateToMultipleValidators(
  delegatorWallet: Wallet,
  validators: Uint8Array[]
) {
  const stakingService = new StakingService(client, delegatorWallet);
  
  const delegateIds: string[] = [];
  
  for (const validator of validators) {
    const result = await stakingService.delegate({
      from: delegatorWallet.address,
      validatorAddr: validator,
      amount: BigInt(100000),
    }, delegatorWallet);
    
    delegateIds.push(result.delegateId!);
  }
  
  return delegateIds;
}
```

---

## ⚠️ 常见错误

### 余额不足

```typescript
try {
  await stakingService.stake({
    from: wallet.address,
    validatorAddr: validatorAddr,
    amount: BigInt(1000000000), // 非常大的金额
  }, wallet);
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('余额不足');
  }
}
```

### 锁定未到期

```typescript
try {
  await stakingService.unstake({
    from: wallet.address,
    stakeId: stakeId,
  }, wallet);
} catch (error) {
  if (error.message.includes('lock not expired')) {
    console.error('锁定未到期，无法解质押');
  }
}
```

---

## 🔗 相关文档

- **[API 参考](../api/services.md#-staking-service)** - 完整 API 文档
- **[Market 指南](./market.md)** - 市场服务指南
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

