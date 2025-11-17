# Token 服务指南

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

Token Service 提供代币操作功能，包括转账、批量转账、铸造、销毁和余额查询。

---

## 🔗 关联文档

- **API 参考**：[Services API - Token](../api/services.md#-token-service)
- **WES 协议**：[WES 系统架构](https://github.com/weisyn/weisyn/blob/main/docs/system/architecture/README.md)

---

## 🚀 快速开始

### 创建服务

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

const wallet = await Wallet.create();
const tokenService = new TokenService(client, wallet);
```

---

## 💸 转账

### 单笔转账

```typescript
const result = await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000000), // 1 WES（假设 6 位小数）
  tokenId: null, // null 表示原生币
}, wallet);

console.log(`转账成功！交易哈希: ${result.txHash}`);
```

### 代币转账

```typescript
// 创建代币 ID（32 字节）
const tokenId = new Uint8Array(32);
tokenId.fill(1); // 示例：使用全 1 作为代币 ID

const result = await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000),
  tokenId: tokenId, // 指定代币 ID
}, wallet);
```

### 转账流程说明

SDK 内部流程：
1. **查询 UTXO**：调用 `wes_getUTXO` 查询发送方的可用 UTXO
2. **选择 UTXO**：自动选择足够的 UTXO 覆盖转账金额
3. **构建交易**：调用 `wes_buildTransaction` 构建交易草稿
4. **签名交易**：使用 Wallet 签名
5. **提交交易**：调用 `wes_sendRawTransaction` 提交交易

---

## 📦 批量转账

### 基本使用

```typescript
const result = await tokenService.batchTransfer({
  from: wallet.address,
  transfers: [
    { to: recipient1.address, amount: BigInt(100000) },
    { to: recipient2.address, amount: BigInt(200000) },
    { to: recipient3.address, amount: BigInt(300000) },
  ],
  tokenId: tokenId, // 所有转账必须使用同一个 tokenId
}, wallet);

console.log(`批量转账成功！交易哈希: ${result.txHash}`);
```

### 注意事项

- ⚠️ **所有转账必须使用同一个 `tokenId`**
- ✅ 批量转账在一个交易中完成，节省 Gas 费
- ✅ 如果任何一笔转账失败，整个交易会回滚

---

## 🪙 代币铸造

### 前提条件

- 需要代币合约已部署
- 需要合约地址和代币 ID

### 铸造代币

```typescript
const result = await tokenService.mint({
  to: recipient.address,
  amount: BigInt(10000),
  tokenId: tokenId,
  contractAddr: contractAddr, // 代币合约地址
}, wallet);

console.log(`铸造成功！交易哈希: ${result.txHash}`);
```

### 实现原理

SDK 内部调用 `wes_callContract`，调用代币合约的 `mint` 方法：

```typescript
// SDK 内部实现（简化）
await client.call('wes_callContract', [
  contractAddr,
  'mint',
  {
    to: recipient.address,
    amount: amount,
  },
  {
    return_unsigned_tx: true,
  },
]);
```

---

## 🔥 代币销毁

### 销毁代币

```typescript
const result = await tokenService.burn({
  from: wallet.address,
  amount: BigInt(5000),
  tokenId: tokenId,
  contractAddr: contractAddr, // 代币合约地址
}, wallet);

console.log(`销毁成功！交易哈希: ${result.txHash}`);
```

---

## 💰 查询余额

### 查询原生币余额

```typescript
const balance = await tokenService.getBalance(
  wallet.address,
  null // null 表示原生币
);

console.log(`余额: ${balance} wei`);
```

### 查询代币余额

```typescript
const tokenBalance = await tokenService.getBalance(
  wallet.address,
  tokenId // 32 字节代币 ID
);

console.log(`代币余额: ${tokenBalance}`);
```

### 实现原理

SDK 内部：
1. 调用 `wes_getUTXO` 查询地址的所有 UTXO
2. 过滤匹配 `tokenId` 的 UTXO
3. 汇总 UTXO 的金额

---

## 🎯 典型场景

### 场景 1：用户支付

```typescript
async function payForService(
  userWallet: Wallet,
  serviceProvider: Uint8Array,
  amount: bigint
) {
  const tokenService = new TokenService(client, userWallet);
  
  const result = await tokenService.transfer({
    from: userWallet.address,
    to: serviceProvider,
    amount: amount,
    tokenId: null, // 使用原生币
  }, userWallet);
  
  return result.txHash;
}
```

### 场景 2：批量发放奖励

```typescript
async function distributeRewards(
  fromWallet: Wallet,
  recipients: Array<{ address: Uint8Array; amount: bigint }>,
  tokenId: Uint8Array
) {
  const tokenService = new TokenService(client, fromWallet);
  
  const result = await tokenService.batchTransfer({
    from: fromWallet.address,
    transfers: recipients.map(r => ({
      to: r.address,
      amount: r.amount,
    })),
    tokenId: tokenId,
  }, fromWallet);
  
  return result.txHash;
}
```

### 场景 3：检查余额是否足够

```typescript
async function checkBalance(
  address: Uint8Array,
  requiredAmount: bigint,
  tokenId: Uint8Array | null
): Promise<boolean> {
  const tokenService = new TokenService(client);
  
  const balance = await tokenService.getBalance(address, tokenId);
  
  return balance >= requiredAmount;
}
```

---

## ⚠️ 常见错误

### 余额不足

```typescript
try {
  await tokenService.transfer({
    from: wallet.address,
    to: recipient.address,
    amount: BigInt(1000000000), // 非常大的金额
    tokenId: null,
  }, wallet);
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('余额不足');
  }
}
```

### 无效地址

```typescript
try {
  await tokenService.transfer({
    from: wallet.address,
    to: new Uint8Array(19), // 错误长度
    amount: BigInt(1000),
    tokenId: null,
  }, wallet);
} catch (error) {
  console.error('地址无效:', error.message);
}
```

---

## 🔗 相关文档

- **[API 参考](../api/services.md#-token-service)** - 完整 API 文档
- **[快速开始](../getting-started.md)** - 安装和配置
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

