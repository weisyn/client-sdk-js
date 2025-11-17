# 批量操作示例

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

批量操作示例，包括批量转账和批量查询余额。

---

## 💻 批量转账示例

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';
import { batchOperation } from '@weisyn/client-sdk-js';

async function batchTransferExample() {
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
  });

  const sender = await Wallet.create();
  const tokenService = new TokenService(client, sender);

  // 准备多个接收方
  const recipients = [
    await Wallet.create(),
    await Wallet.create(),
    await Wallet.create(),
  ];

  // 批量转账
  const transferAmount = BigInt(100000); // 每个接收方 0.1 WES

  const result = await tokenService.batchTransfer({
    from: sender.address,
    transfers: recipients.map(recipient => ({
      to: recipient.address,
      amount: transferAmount,
    })),
    tokenId: null, // 所有转账使用同一个 tokenId
  }, sender);

  console.log(`批量转账成功！`);
  console.log(`交易哈希: ${result.txHash}`);
  console.log(`转账数量: ${recipients.length}`);
}
```

---

## 💻 批量查询余额示例

```typescript
import { Client, TokenService } from '@weisyn/client-sdk-js';
import { batchQuery } from '@weisyn/client-sdk-js';

async function batchQueryBalanceExample() {
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
  });

  const tokenService = new TokenService(client);

  // 准备多个地址
  const addresses = [
    hexToBytes('0x' + '1'.repeat(40)),
    hexToBytes('0x' + '2'.repeat(40)),
    hexToBytes('0x' + '3'.repeat(40)),
  ];

  // 批量查询余额
  const balances = await batchQuery(
    addresses,
    async (address) => {
      return await tokenService.getBalance(address, null);
    },
    {
      batchSize: 50,
      concurrency: 5,
      onProgress: (progress) => {
        console.log(`查询进度: ${progress.percentage}%`);
      },
    }
  );

  // 输出结果
  addresses.forEach((address, index) => {
    console.log(`地址 ${index + 1}: ${balances[index]}`);
  });
}
```

---

## 💻 批量操作（容错）示例

```typescript
import { batchOperation } from '@weisyn/client-sdk-js';

async function batchTransferWithRetry() {
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
  });

  const sender = await Wallet.create();
  const tokenService = new TokenService(client, sender);

  const transfers = [
    { to: recipient1.address, amount: BigInt(100000) },
    { to: recipient2.address, amount: BigInt(200000) },
    { to: recipient3.address, amount: BigInt(300000) },
  ];

  // 批量操作（支持部分失败）
  const result = await batchOperation(
    transfers,
    async (transfer) => {
      await tokenService.transfer({
        from: sender.address,
        to: transfer.to,
        amount: transfer.amount,
        tokenId: null,
      }, sender);
    },
    {
      concurrency: 3,
      onProgress: (progress) => {
        console.log(`成功: ${progress.success}, 失败: ${progress.failed}`);
      },
    }
  );

  console.log(`批量转账完成:`);
  console.log(`成功: ${result.success}`);
  console.log(`失败: ${result.failed}`);

  // 处理失败的项目
  if (result.errors.length > 0) {
    console.error('失败的转账:');
    result.errors.forEach((error, index) => {
      console.error(`索引 ${error.index}: ${error.error.message}`);
    });
  }
}
```

---

## 🔍 代码说明

### batchTransfer

`TokenService.batchTransfer` 在一个交易中完成多个转账：

```typescript
const result = await tokenService.batchTransfer({
  from: sender.address,
  transfers: [
    { to: addr1, amount: BigInt(100000) },
    { to: addr2, amount: BigInt(200000) },
  ],
  tokenId: null, // 所有转账必须使用同一个 tokenId
}, sender);
```

**优点**：
- 节省 Gas 费（一个交易完成多个转账）
- 原子性（要么全部成功，要么全部失败）

### batchQuery

`batchQuery` 用于批量查询，支持并发和进度监控：

```typescript
const results = await batchQuery(
  items,
  async (item) => {
    return await queryFunction(item);
  },
  {
    batchSize: 50,      // 批量大小
    concurrency: 5,     // 并发数量
    onProgress: (progress) => {
      console.log(`进度: ${progress.percentage}%`);
    },
  }
);
```

### batchOperation

`batchOperation` 用于批量操作，支持部分失败：

```typescript
const result = await batchOperation(
  items,
  async (item) => {
    await operationFunction(item);
  },
  {
    concurrency: 3,
    onProgress: (progress) => {
      console.log(`成功: ${progress.success}, 失败: ${progress.failed}`);
    },
  }
);
```

---

## 🎯 运行示例

```bash
# 1. 安装依赖
npm install @weisyn/client-sdk-js

# 2. 创建示例文件
# batch-operations.ts

# 3. 运行
npx ts-node batch-operations.ts
```

---

## ⚠️ 注意事项

1. **批量大小**：根据实际情况调整批量大小和并发数
2. **错误处理**：批量操作可能部分失败，需要处理错误
3. **性能考虑**：并发数过高可能增加节点压力

---

## 🔗 相关文档

- **[批量操作参考](../reference/batch.md)** - 批量操作详细说明
- **[Token 指南](../guides/token.md)** - Token 服务指南
- **[API 参考](../api/services.md#-token-service)** - Token Service API

---

**最后更新**: 2025-11-17

