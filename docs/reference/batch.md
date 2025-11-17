# 批量操作参考

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

SDK 提供了批量操作工具，可以高效处理大量数据，支持并发控制和进度监控。

---

## 🔗 关联文档

- **性能优化**：[性能优化指南](../reference/performance.md)（待创建）
- **API 参考**：[Services API](../api/services.md)

---

## 📦 导入

```typescript
import {
  batchQuery,
  batchOperation,
  parallelExecute,
  batchArray,
} from '@weisyn/client-sdk-js';
```

---

## 🔍 批量查询

### batchQuery()

批量查询多个项目，支持并发控制和错误处理。

```typescript
async function batchQuery<T, R>(
  items: T[],
  queryFn: (item: T, index: number) => Promise<R>,
  options?: {
    batchSize?: number;      // 批量大小，默认 50
    concurrency?: number;    // 并发数量，默认 5
    onProgress?: (progress: {
      processed: number;
      total: number;
      percentage: number;
    }) => void;
  }
): Promise<R[]>
```

### 示例：批量查询余额

```typescript
import { batchQuery } from '@weisyn/client-sdk-js';
import { TokenService } from '@weisyn/client-sdk-js';

const addresses = [
  address1,
  address2,
  address3,
  // ... 更多地址
];

const tokenService = new TokenService(client);

const balances = await batchQuery(
  addresses,
  async (address) => {
    return await tokenService.getBalance(address, null);
  },
  {
    batchSize: 50,
    concurrency: 5,
    onProgress: (progress) => {
      console.log(`进度: ${progress.percentage}%`);
    },
  }
);
```

---

## ⚙️ 批量操作

### batchOperation()

批量执行操作，支持部分失败。

```typescript
async function batchOperation<T>(
  items: T[],
  operationFn: (item: T, index: number) => Promise<void>,
  options?: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: (progress: {
      processed: number;
      total: number;
      percentage: number;
      success: number;
      failed: number;
    }) => void;
  }
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ index: number; error: Error }>;
}>
```

### 示例：批量转账

```typescript
import { batchOperation } from '@weisyn/client-sdk-js';

const transfers = [
  { to: addr1, amount: BigInt(100000) },
  { to: addr2, amount: BigInt(200000) },
  { to: addr3, amount: BigInt(300000) },
];

const result = await batchOperation(
  transfers,
  async (transfer) => {
    await tokenService.transfer({
      from: wallet.address,
      to: transfer.to,
      amount: transfer.amount,
      tokenId: null,
    }, wallet);
  },
  {
    concurrency: 3,
    onProgress: (progress) => {
      console.log(`成功: ${progress.success}, 失败: ${progress.failed}`);
    },
  }
);

console.log(`批量转账完成: 成功 ${result.success}, 失败 ${result.failed}`);
```

---

## 🚀 并行执行

### parallelExecute()

并行执行多个操作，所有操作必须成功。

```typescript
async function parallelExecute<T, R>(
  items: T[],
  executeFn: (item: T) => Promise<R>,
  concurrency?: number
): Promise<R[]>
```

### 示例：并行查询

```typescript
import { parallelExecute } from '@weisyn/client-sdk-js';

const addresses = [address1, address2, address3];

const balances = await parallelExecute(
  addresses,
  async (address) => {
    return await tokenService.getBalance(address, null);
  },
  5 // 最多 5 个并发
);
```

---

## 📊 数组分批

### batchArray()

将数组分成多个批次。

```typescript
function batchArray<T>(
  array: T[],
  batchSize: number
): T[][]
```

### 示例：分批处理

```typescript
import { batchArray } from '@weisyn/client-sdk-js';

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const batches = batchArray(items, 3);

// batches = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]

for (const batch of batches) {
  await processBatch(batch);
}
```

---

## 🎯 典型场景

### 场景 1：批量查询多个账户余额

```typescript
async function getMultipleBalances(
  addresses: Uint8Array[],
  tokenId: Uint8Array | null
) {
  const tokenService = new TokenService(client);
  
  const balances = await batchQuery(
    addresses,
    async (address) => {
      return await tokenService.getBalance(address, tokenId);
    },
    {
      batchSize: 50,
      concurrency: 5,
      onProgress: (progress) => {
        console.log(`查询进度: ${progress.percentage}%`);
      },
    }
  );
  
  return balances;
}
```

### 场景 2：批量转账（容错）

```typescript
async function batchTransferWithRetry(
  transfers: Array<{ to: Uint8Array; amount: bigint }>,
  wallet: Wallet
) {
  const tokenService = new TokenService(client, wallet);
  
  const result = await batchOperation(
    transfers,
    async (transfer) => {
      await tokenService.transfer({
        from: wallet.address,
        to: transfer.to,
        amount: transfer.amount,
        tokenId: null,
      }, wallet);
    },
    {
      concurrency: 3,
      onProgress: (progress) => {
        console.log(`成功: ${progress.success}, 失败: ${progress.failed}`);
      },
    }
  );
  
  // 处理失败的项目
  if (result.errors.length > 0) {
    console.error('失败的转账:');
    for (const error of result.errors) {
      console.error(`索引 ${error.index}: ${error.error.message}`);
    }
  }
  
  return result;
}
```

---

## ⚙️ 性能优化建议

### 并发数量

- **查询操作**：建议 5-10 个并发
- **写入操作**：建议 3-5 个并发（避免节点压力过大）

### 批量大小

- **小批量**（10-50）：适合实时查询
- **大批量**（50-200）：适合批量处理

### 进度监控

```typescript
const result = await batchQuery(
  items,
  queryFn,
  {
    onProgress: (progress) => {
      // 更新 UI 进度条
      updateProgressBar(progress.percentage);
      
      // 记录日志
      logger.info(`处理进度: ${progress.processed}/${progress.total}`);
    },
  }
);
```

---

## 🔗 相关文档

- **[Services API](../api/services.md)** - 业务服务 API
- **[性能优化](../reference/performance.md)** - 性能优化指南（待创建）
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

