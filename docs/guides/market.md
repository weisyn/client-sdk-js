# Market 服务指南

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

Market Service 提供市场相关功能，包括 AMM 代币交换、流动性管理、托管和归属计划。

---

## 🔗 关联文档

- **API 参考**：[Services API - Market](../api/services.md#-market-service)
- **WES 协议**：[WES 市场机制](https://github.com/weisyn/weisyn/blob/main/docs/system/platforms/market/README.md)（待确认）

---

## 🚀 快速开始

### 创建服务

```typescript
import { Client, MarketService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

const wallet = await Wallet.create();
const marketService = new MarketService(client, wallet);
```

---

## 💱 AMM 代币交换

### 基本交换

```typescript
const ammContractAddr = hexToBytes('0x...'); // AMM 合约地址
const tokenA = hexToBytes('0x...'); // Token A 的 ID
const tokenB = hexToBytes('0x...'); // Token B 的 ID

const result = await marketService.swapAMM({
  from: wallet.address,
  contractAddr: ammContractAddr,
  tokenIn: tokenA,
  amountIn: BigInt(1000000),
  tokenOut: tokenB,
  amountOutMin: BigInt(900000), // 滑点保护：最小输出量
}, wallet);

console.log(`交换成功！交易哈希: ${result.txHash}`);
console.log(`实际输出: ${result.amountOut}`);
```

### 滑点保护

```typescript
// 设置最小输出量，防止滑点过大
const result = await marketService.swapAMM({
  from: wallet.address,
  contractAddr: ammContractAddr,
  tokenIn: tokenA,
  amountIn: BigInt(1000000),
  tokenOut: tokenB,
  amountOutMin: BigInt(950000), // 至少获得 95% 的预期输出
}, wallet);
```

### 实现原理

SDK 内部调用 `wes_callContract`，调用 AMM 合约的 `swap` 方法：

```typescript
// SDK 内部实现（简化）
await client.call('wes_callContract', [
  contractAddr,
  'swap',
  {
    tokenIn: tokenIn,
    amountIn: amountIn,
    tokenOut: tokenOut,
    amountOutMin: amountOutMin,
  },
  {
    return_unsigned_tx: true,
  },
]);
```

---

## 💧 流动性管理

### 添加流动性

```typescript
const result = await marketService.addLiquidity({
  from: wallet.address,
  contractAddr: ammContractAddr,
  tokenA: tokenA,
  amountA: BigInt(1000000),
  tokenB: tokenB,
  amountB: BigInt(1000000),
}, wallet);

console.log(`添加流动性成功！交易哈希: ${result.txHash}`);
console.log(`流动性 ID: ${result.liquidityId}`);
```

### 移除流动性

```typescript
const result = await marketService.removeLiquidity({
  from: wallet.address,
  contractAddr: ammContractAddr,
  liquidityId: liquidityId, // 之前添加流动性时获得的 ID
  amount: BigInt(500000), // 移除部分流动性
}, wallet);

console.log(`移除流动性成功！交易哈希: ${result.txHash}`);
console.log(`获得 Token A: ${result.amountA}`);
console.log(`获得 Token B: ${result.amountB}`);
```

---

## 🔒 托管（Escrow）

### 创建托管

```typescript
const seller = await Wallet.create();

const result = await marketService.createEscrow({
  from: wallet.address, // 买方
  seller: seller.address,
  amount: BigInt(1000000),
  tokenId: null, // null 表示原生币
}, wallet);

console.log(`创建托管成功！交易哈希: ${result.txHash}`);
console.log(`托管 ID: ${result.escrowId}`);
```

### 释放托管（给卖方）

```typescript
// 卖方操作
const sellerMarketService = new MarketService(client, seller);

const result = await sellerMarketService.releaseEscrow({
  from: seller.address,
  escrowId: escrowId,
}, seller);

console.log(`释放托管成功！交易哈希: ${result.txHash}`);
```

### 退款托管（给买方）

```typescript
// 买方操作（例如：交易取消或过期）
const result = await marketService.refundEscrow({
  from: wallet.address,
  escrowId: escrowId,
}, wallet);

console.log(`退款成功！交易哈希: ${result.txHash}`);
```

### 实现原理

托管使用 `MultiKeyLock` 锁定条件，需要买方和卖方共同签名才能释放。

---

## 📅 归属计划（Vesting）

### 创建归属计划

```typescript
const recipient = await Wallet.create();
const unlockTime = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 天后解锁

const result = await marketService.createVesting({
  from: wallet.address,
  recipient: recipient.address,
  amount: BigInt(10000000),
  tokenId: tokenId,
  unlockTime: unlockTime,
}, wallet);

console.log(`创建归属计划成功！交易哈希: ${result.txHash}`);
console.log(`归属 ID: ${result.vestingId}`);
```

### 领取归属代币

```typescript
// 接收者操作（解锁时间到达后）
const recipientMarketService = new MarketService(client, recipient);

const result = await recipientMarketService.claimVesting({
  from: recipient.address,
  vestingId: vestingId,
}, recipient);

console.log(`领取归属代币成功！交易哈希: ${result.txHash}`);
```

### 实现原理

归属计划使用 `TimeLock` + `SingleKeyLock` 锁定条件，只有到达解锁时间后才能领取。

---

## 🎯 典型场景

### 场景 1：完整的 AMM 流动性流程

```typescript
async function completeAMMFlow(
  providerWallet: Wallet,
  ammContractAddr: Uint8Array,
  tokenA: Uint8Array,
  tokenB: Uint8Array
) {
  const marketService = new MarketService(client, providerWallet);
  
  // 1. 添加流动性
  const addResult = await marketService.addLiquidity({
    from: providerWallet.address,
    contractAddr: ammContractAddr,
    tokenA: tokenA,
    amountA: BigInt(1000000),
    tokenB: tokenB,
    amountB: BigInt(1000000),
  }, providerWallet);
  
  console.log(`流动性 ID: ${addResult.liquidityId}`);
  
  // 2. 等待一段时间后，移除部分流动性
  // ... 等待 ...
  
  const removeResult = await marketService.removeLiquidity({
    from: providerWallet.address,
    contractAddr: ammContractAddr,
    liquidityId: addResult.liquidityId!,
    amount: BigInt(500000), // 移除一半
  }, providerWallet);
  
  console.log(`获得 Token A: ${removeResult.amountA}`);
  console.log(`获得 Token B: ${removeResult.amountB}`);
}
```

### 场景 2：托管交易流程

```typescript
async function escrowTransactionFlow(
  buyer: Wallet,
  seller: Wallet
) {
  const buyerMarketService = new MarketService(client, buyer);
  const sellerMarketService = new MarketService(client, seller);
  
  // 1. 买方创建托管
  const escrowResult = await buyerMarketService.createEscrow({
    from: buyer.address,
    seller: seller.address,
    amount: BigInt(1000000),
    tokenId: null,
  }, buyer);
  
  console.log(`托管 ID: ${escrowResult.escrowId}`);
  
  // 2. 卖方确认收到商品后，释放托管
  const releaseResult = await sellerMarketService.releaseEscrow({
    from: seller.address,
    escrowId: escrowResult.escrowId!,
  }, seller);
  
  console.log(`托管已释放给卖方`);
}
```

### 场景 3：代币归属计划

```typescript
async function createTokenVesting(
  issuer: Wallet,
  employee: Wallet,
  totalAmount: bigint,
  vestingMonths: number
) {
  const marketService = new MarketService(client, issuer);
  
  // 计算解锁时间（按月归属）
  const unlockTime = Math.floor(Date.now() / 1000) + vestingMonths * 30 * 24 * 60 * 60;
  
  const result = await marketService.createVesting({
    from: issuer.address,
    recipient: employee.address,
    amount: totalAmount,
    tokenId: tokenId,
    unlockTime: unlockTime,
  }, issuer);
  
  console.log(`归属计划已创建，将在 ${vestingMonths} 个月后解锁`);
  return result.vestingId;
}
```

---

## ⚠️ 常见错误

### 滑点过大

```typescript
try {
  await marketService.swapAMM({
    from: wallet.address,
    contractAddr: ammContractAddr,
    tokenIn: tokenA,
    amountIn: BigInt(1000000),
    tokenOut: tokenB,
    amountOutMin: BigInt(999999), // 设置过高的最小输出量
  }, wallet);
} catch (error) {
  if (error.message.includes('slippage')) {
    console.error('滑点过大，交易失败');
  }
}
```

### 流动性不足

```typescript
try {
  await marketService.removeLiquidity({
    from: wallet.address,
    contractAddr: ammContractAddr,
    liquidityId: liquidityId,
    amount: BigInt(1000000000), // 超过实际流动性
  }, wallet);
} catch (error) {
  if (error.message.includes('insufficient liquidity')) {
    console.error('流动性不足');
  }
}
```

### 解锁时间未到

```typescript
try {
  await marketService.claimVesting({
    from: recipient.address,
    vestingId: vestingId,
  }, recipient);
} catch (error) {
  if (error.message.includes('not unlocked')) {
    console.error('归属代币尚未解锁');
  }
}
```

---

## 🔗 相关文档

- **[API 参考](../api/services.md#-market-service)** - 完整 API 文档
- **[Token 指南](./token.md)** - 代币操作指南
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

