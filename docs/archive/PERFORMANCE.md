# 性能优化指南

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：draft
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK（已归档）

---

## 📋 概述

本文档介绍 WES Client SDK (JS/TS) 的性能优化功能和使用方法。

---

## 🚀 性能优化功能

### 1. 请求重试机制

SDK 提供了指数退避重试机制，自动处理网络请求失败的情况。

#### 配置重试

```typescript
import { Client } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 3,              // 最大重试次数
    initialDelay: 1000,         // 初始延迟（毫秒）
    maxDelay: 10000,            // 最大延迟（毫秒）
    backoffMultiplier: 2,      // 退避倍数
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}:`, error.message);
    },
  },
});
```

#### 默认重试配置

- **最大重试次数**: 3
- **初始延迟**: 1000ms
- **最大延迟**: 10000ms
- **退避倍数**: 2

#### 可重试的错误

以下错误会自动重试：
- 网络错误（无响应、连接拒绝等）
- HTTP 5xx 错误（服务器错误）
- HTTP 429 错误（请求过多）

#### 自定义重试逻辑

```typescript
import { withRetry } from '@weisyn/client-sdk-js/utils/retry';

const result = await withRetry(
  async () => {
    // 执行可能失败的操作
    return await someOperation();
  },
  {
    maxRetries: 5,
    initialDelay: 500,
    retryable: (error) => {
      // 自定义可重试错误判断
      return error.message.includes('timeout');
    },
  }
);
```

---

### 2. 大文件处理优化

SDK 提供了流式处理和分块上传功能，优化大文件处理性能。

#### 分块处理文件

```typescript
import { processFileInChunks } from '@weisyn/client-sdk-js/utils/file';

const largeFile = new Uint8Array(100 * 1024 * 1024); // 100MB

const results = await processFileInChunks(
  largeFile,
  async (chunk, index) => {
    // 处理每个分块
    console.log(`Processing chunk ${index}, size: ${chunk.length}`);
    return await processChunk(chunk);
  },
  {
    chunkSize: 1024 * 1024,      // 1MB 分块
    concurrency: 3,              // 并发3个分块
    onProgress: (progress) => {
      console.log(`Progress: ${progress.percentage}%`);
    },
  }
);
```

#### 流式读取文件（浏览器）

```typescript
import { readFileAsStream } from '@weisyn/client-sdk-js/utils/file';

const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const data = await readFileAsStream(file, (chunk, index) => {
    console.log(`Read chunk ${index}, size: ${chunk.length}`);
  });
  
  // 使用 data
}
```

#### 文件分块工具

```typescript
import { chunkFile, estimateProcessingTime } from '@weisyn/client-sdk-js/utils/file';

// 将文件分块
const chunks = chunkFile(largeFile, 1024 * 1024); // 1MB 分块

// 估算处理时间
const estimatedTime = estimateProcessingTime(
  100 * 1024 * 1024,  // 100MB
  1024 * 1024,         // 1MB 分块
  1024 * 1024          // 1MB/s 处理速度
);
```

---

### 3. 批量操作支持

SDK 提供了批量查询和批量操作功能，提升性能。

#### 批量查询

```typescript
import { batchQuery } from '@weisyn/client-sdk-js/utils/batch';

const addresses = [
  address1,
  address2,
  address3,
  // ... 更多地址
];

const results = await batchQuery(
  addresses,
  async (address, index) => {
    // 查询每个地址的余额
    return await tokenService.getBalance(address, null);
  },
  {
    batchSize: 50,              // 每批50个
    concurrency: 5,             // 并发5个
    onProgress: (progress) => {
      console.log(`Progress: ${progress.percentage}%`);
      console.log(`Success: ${progress.success}, Failed: ${progress.failed}`);
    },
  }
);

console.log(`Total: ${results.total}`);
console.log(`Success: ${results.success}`);
console.log(`Failed: ${results.failed}`);
console.log(`Results:`, results.results);
console.log(`Errors:`, results.errors);
```

#### 并行执行

```typescript
import { parallelExecute } from '@weisyn/client-sdk-js/utils/batch';

const items = [item1, item2, item3, /* ... */];

const results = await parallelExecute(
  items,
  async (item) => {
    return await processItem(item);
  },
  5 // 并发5个
);
```

---

## 📊 性能建议

### 1. 大文件上传

**推荐配置**：
- 分块大小：1-5MB
- 并发数量：3-5个
- 使用进度回调监控上传进度

**示例**：
```typescript
await resourceService.deployContract({
  from: wallet.address,
  wasmContent: largeWasmFile,
  contractName: 'MyContract',
});

// 对于超大文件，使用分块处理
import { processFileInChunks } from '@weisyn/client-sdk-js/utils/file';

await processFileInChunks(
  largeWasmFile,
  async (chunk, index) => {
    // 上传分块（需要服务端支持分块上传）
    return await uploadChunk(chunk, index);
  },
  {
    chunkSize: 5 * 1024 * 1024, // 5MB
    concurrency: 3,
  }
);
```

### 2. 批量查询

**推荐配置**：
- 批量大小：50-100个
- 并发数量：5-10个
- 使用进度回调监控查询进度

**示例**：
```typescript
// 批量查询余额
const balances = await batchQuery(
  addresses,
  async (address) => await tokenService.getBalance(address, null),
  {
    batchSize: 50,
    concurrency: 5,
  }
);
```

### 3. 网络请求

**推荐配置**：
- 启用重试机制（默认已启用）
- 设置合理的超时时间
- 使用连接池（HTTP/2）

**示例**：
```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 30000, // 30秒超时
  retry: {
    maxRetries: 3,
    initialDelay: 1000,
  },
});
```

---

## 🔧 性能监控

### 进度回调

所有批量操作和文件处理都支持进度回调：

```typescript
{
  onProgress: (progress) => {
    console.log(`Progress: ${progress.percentage}%`);
    console.log(`Completed: ${progress.completed}/${progress.total}`);
    
    // 文件处理进度
    if ('currentChunk' in progress) {
      console.log(`Chunk: ${progress.currentChunk}/${progress.totalChunks}`);
    }
    
    // 批量操作进度
    if ('success' in progress) {
      console.log(`Success: ${progress.success}, Failed: ${progress.failed}`);
    }
  },
}
```

---

## 📚 相关文档

- [API 参考](./API.md)
- [浏览器兼容性](./BROWSER_COMPATIBILITY.md)
- [使用示例](../examples/)

---

**最后更新**: 2025-11-17

