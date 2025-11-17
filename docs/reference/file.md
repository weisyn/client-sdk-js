# 大文件处理参考

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

SDK 提供了大文件处理工具，支持分块处理、流式读取和进度监控，避免一次性加载大文件到内存。

---

## 🔗 关联文档

- **Resource 服务**：[Resource 指南](../guides/resource.md)
- **性能优化**：[性能优化指南](../reference/performance.md)（待创建）

---

## 📦 导入

```typescript
import {
  chunkFile,
  processFileInChunks,
  readFileAsStream,
  estimateProcessingTime,
} from '@weisyn/client-sdk-js';
```

---

## 🔪 文件分块

### chunkFile()

将文件内容分成多个块。

```typescript
function chunkFile(
  file: File | Uint8Array,
  chunkSize: number
): Uint8Array[]
```

### 示例

```typescript
import { chunkFile } from '@weisyn/client-sdk-js';

const fileContent = new Uint8Array(10 * 1024 * 1024); // 10MB
const chunks = chunkFile(fileContent, 1024 * 1024); // 1MB 每块

console.log(`分成 ${chunks.length} 块`);
```

---

## ⚙️ 分块处理

### processFileInChunks()

分块处理文件，支持并发和进度监控。

```typescript
async function processFileInChunks<T>(
  file: File | Uint8Array,
  processChunkFn: (chunk: Uint8Array, index: number) => Promise<T>,
  options?: {
    chunkSize?: number;      // 分块大小（字节），默认 1MB
    concurrency?: number;    // 并发数量，默认 3
    onProgress?: (progress: {
      processed: number;
      total: number;
      percentage: number;
    }) => void;
  }
): Promise<T[]>
```

### 示例：分块上传

```typescript
import { processFileInChunks } from '@weisyn/client-sdk-js';
import { ResourceService } from '@weisyn/client-sdk-js';

const resourceService = new ResourceService(client, wallet);

// 读取文件（Node.js）
const fs = require('fs').promises;
const fileContent = await fs.readFile('large_file.bin');

// 分块处理并上传
const results = await processFileInChunks(
  fileContent,
  async (chunk, index) => {
    // 处理每个分块（例如：上传到临时存储）
    return await uploadChunk(chunk, index);
  },
  {
    chunkSize: 5 * 1024 * 1024, // 5MB 每块
    concurrency: 3,
    onProgress: (progress) => {
      console.log(`上传进度: ${progress.percentage}%`);
    },
  }
);
```

---

## 🌊 流式读取

### readFileAsStream()

流式读取文件，支持进度回调。

```typescript
async function readFileAsStream(
  filePath: string, // Node.js 环境
  onProgress?: (progress: {
    loaded: number;
    total: number;
    percentage: number;
  }) => void
): Promise<Uint8Array>
```

### 示例：流式读取大文件

```typescript
import { readFileAsStream } from '@weisyn/client-sdk-js';

// Node.js 环境
const fileContent = await readFileAsStream(
  'large_file.bin',
  (progress) => {
    console.log(`读取进度: ${progress.percentage}%`);
  }
);
```

**浏览器环境**：
```typescript
// 浏览器环境需要使用 FileReader 或 File API
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const fileContent = new Uint8Array(await file.arrayBuffer());
```

---

## ⏱️ 处理时间估算

### estimateProcessingTime()

估算文件处理时间。

```typescript
function estimateProcessingTime(
  fileSize: number,
  chunkSize: number,
  processingSpeed: number // 字节/秒
): number // 返回秒数
```

### 示例

```typescript
import { estimateProcessingTime } from '@weisyn/client-sdk-js';

const fileSize = 100 * 1024 * 1024; // 100MB
const chunkSize = 5 * 1024 * 1024; // 5MB
const processingSpeed = 10 * 1024 * 1024; // 10MB/s

const estimatedTime = estimateProcessingTime(
  fileSize,
  chunkSize,
  processingSpeed
);

console.log(`预计处理时间: ${estimatedTime} 秒`);
```

---

## 🎯 典型场景

### 场景 1：部署大文件资源

```typescript
import { ResourceService } from '@weisyn/client-sdk-js';
import { processFileInChunks } from '@weisyn/client-sdk-js';

async function deployLargeFile(
  filePath: string,
  mimeType: string,
  wallet: Wallet
) {
  const resourceService = new ResourceService(client, wallet);
  
  // Node.js 环境：读取文件
  const fs = require('fs').promises;
  const fileContent = await fs.readFile(filePath);
  
  // 如果文件很大，可以分块处理
  if (fileContent.length > 10 * 1024 * 1024) {
    // 大文件：分块处理
    const chunks = await processFileInChunks(
      fileContent,
      async (chunk) => {
        // 可以在这里预处理每个分块
        return chunk;
      },
      {
        chunkSize: 5 * 1024 * 1024,
        onProgress: (progress) => {
          console.log(`处理进度: ${progress.percentage}%`);
        },
      }
    );
  }
  
  // 部署资源
  const result = await resourceService.deployStaticResource({
    from: wallet.address,
    fileContent: fileContent,
    mimeType: mimeType,
  }, wallet);
  
  return result.resourceId;
}
```

### 场景 2：浏览器文件上传

```typescript
async function uploadFileInBrowser(
  file: File,
  wallet: Wallet
) {
  const resourceService = new ResourceService(client, wallet);
  
  // 浏览器环境：读取文件为 Uint8Array
  const fileContent = new Uint8Array(await file.arrayBuffer());
  
  // 如果文件很大，显示进度
  if (fileContent.length > 10 * 1024 * 1024) {
    // 可以在这里添加进度显示
    console.log(`文件大小: ${fileContent.length} 字节`);
  }
  
  // 部署资源
  const result = await resourceService.deployStaticResource({
    from: wallet.address,
    fileContent: fileContent,
    mimeType: file.type,
  }, wallet);
  
  return result.resourceId;
}
```

---

## ⚙️ 性能优化建议

### 分块大小

- **小文件**（< 1MB）：不需要分块
- **中等文件**（1-10MB）：1-2MB 分块
- **大文件**（> 10MB）：5-10MB 分块

### 并发数量

- **读取操作**：建议 3-5 个并发
- **上传操作**：建议 2-3 个并发（避免网络拥塞）

### 内存管理

```typescript
// ✅ 推荐：分块处理，避免一次性加载
const chunks = chunkFile(largeFile, 5 * 1024 * 1024);
for (const chunk of chunks) {
  await processChunk(chunk);
  // chunk 处理完后可以被 GC 回收
}

// ❌ 不推荐：一次性加载整个文件
const entireFile = await readEntireFile(); // 可能 OOM
```

---

## 🔗 相关文档

- **[Resource 指南](../guides/resource.md)** - 资源部署指南
- **[浏览器兼容性](../browser.md)** - 浏览器环境使用
- **[性能优化](../reference/performance.md)** - 性能优化指南（待创建）

---

**最后更新**: 2025-11-17

