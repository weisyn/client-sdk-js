# 最佳实践指南

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

本文档提供 WES Client SDK (JS/TS) 的最佳实践建议，帮助开发者高效、安全地使用 SDK。

---

## 🔐 安全最佳实践

### 1. 私钥管理

#### ✅ 推荐做法

```typescript
import { Wallet, Keystore } from '@weisyn/client-sdk-js';

// 1. 使用 Keystore 加密存储私钥
const wallet = await Wallet.create();
const keystore = await Keystore.create(wallet, 'strong-password');
// 保存 keystore 到安全存储

// 2. 从 Keystore 恢复钱包
const restoredWallet = await Keystore.recover(keystore, 'strong-password');

// 3. 使用后立即清除内存中的私钥引用
// （JavaScript 无法强制清除，但可以设置为 null）
```

#### ❌ 避免做法

```typescript
// ❌ 不要在代码中硬编码私钥
const privateKey = '0x1234...'; // 危险！

// ❌ 不要将私钥存储在 localStorage（未加密）
localStorage.setItem('privateKey', privateKey); // 危险！

// ❌ 不要在日志中输出私钥
console.log('Private key:', wallet.exportPrivateKey()); // 危险！
```

---

### 2. 地址验证

#### ✅ 推荐做法

```typescript
import { isValidAddress } from '@weisyn/client-sdk-js/utils/address';

// 验证地址格式
if (!isValidAddress(userInput)) {
  throw new Error('Invalid address format');
}

// 验证地址长度
if (address.length !== 20) {
  throw new Error('Invalid address length');
}
```

---

### 3. 交易签名

#### ✅ 推荐做法

```typescript
// 1. 验证交易参数
if (amount <= 0) {
  throw new Error('Invalid amount');
}

// 2. 验证地址匹配
if (!addressesEqual(wallet.address, request.from)) {
  throw new Error('Address mismatch');
}

// 3. 签名前确认（用户确认）
const confirmed = await userConfirm('Sign transaction?');
if (!confirmed) {
  return;
}

// 4. 签名并提交
const result = await tokenService.transfer(request, wallet);
```

---

## 🚀 性能最佳实践

### 1. 批量操作

#### 批量转账

```typescript
import { TokenService } from '@weisyn/client-sdk-js/services/token';

// ✅ 使用 BatchTransfer（一次交易处理多个转账）
const result = await tokenService.batchTransfer({
  from: wallet.address,
  transfers: [
    { to: addr1, amount: 100 },
    { to: addr2, amount: 200 },
    { to: addr3, amount: 300 },
  ],
  tokenId: tokenID, // 所有转账必须使用同一个 tokenID
}, wallet);

// ❌ 避免多次单独转账
for (const transfer of transfers) {
  await tokenService.transfer({ ...transfer, from: wallet.address }); // 低效
}
```

#### 批量查询

```typescript
import { batchQuery } from '@weisyn/client-sdk-js/utils/batch';

// ✅ 使用批量查询工具
const addresses = [addr1, addr2, addr3, ...];
const results = await batchQuery(
  addresses,
  async (address) => await tokenService.getBalance(address, null),
  {
    batchSize: 50,
    concurrency: 5,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.percentage}%`);
    },
  }
);

// ❌ 避免串行查询
const balances = [];
for (const addr of addresses) {
  balances.push(await tokenService.getBalance(addr, null)); // 低效
}
```

---

### 2. 请求重试配置

#### 生产环境

```typescript
import { Client } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'https://node.example.com',
  protocol: 'http',
  timeout: 30000,
  retry: {
    maxRetries: 5,              // 生产环境增加重试次数
    initialDelay: 1000,
    maxDelay: 30000,            // 增加最大延迟
    backoffMultiplier: 2.0,
    onRetry: (attempt, error) => {
      // 记录重试日志
      console.warn(`Retry attempt ${attempt}:`, error.message);
    },
  },
});
```

#### 开发环境

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 10000,
  retry: {
    maxRetries: 2,              // 开发环境减少重试次数
    initialDelay: 500,
    maxDelay: 5000,
  },
});
```

---

### 3. 大文件处理

#### 浏览器环境

```typescript
import { readFileAsStream, processFileInChunks } from '@weisyn/client-sdk-js/utils/file';

// ✅ 使用流式读取大文件
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file && file.size > 10 * 1024 * 1024) { // 大于 10MB
  const data = await readFileAsStream(file, (chunk, index) => {
    console.log(`Read chunk ${index}, size: ${chunk.length}`);
  });
  
  // 分块处理
  await processFileInChunks(data, async (chunk, index) => {
    return await processChunk(chunk);
  }, {
    chunkSize: 5 * 1024 * 1024, // 5MB 分块
    concurrency: 3,
    onProgress: (progress) => {
      console.log(`Processing: ${progress.percentage}%`);
    },
  });
}
```

#### Node.js 环境

```typescript
// ✅ 直接使用文件路径（Node.js 会自动处理）
await resourceService.deployContract({
  from: wallet.address,
  wasmPath: './contract.wasm', // Node.js 会自动读取
  contractName: 'MyContract',
});
```

---

## 🎯 错误处理最佳实践

### 1. 错误类型识别

```typescript
import {
  SDKError,
  NetworkError,
  ValidationError,
  TransactionError,
  BrowserCompatibilityError,
} from '@weisyn/client-sdk-js/client/errors';

try {
  await tokenService.transfer(request, wallet);
} catch (error) {
  if (error instanceof ValidationError) {
    // 参数验证错误：提示用户修正输入
    showUserError(`Invalid input: ${error.message}`);
  } else if (error instanceof NetworkError) {
    // 网络错误：提示用户检查网络连接
    showUserError('Network error. Please check your connection.');
  } else if (error instanceof TransactionError) {
    // 交易错误：显示交易哈希，用户可以查询
    showUserError(`Transaction failed: ${error.txHash}`);
  } else if (error instanceof BrowserCompatibilityError) {
    // 浏览器兼容性错误：提示用户使用支持的浏览器
    showUserError(`Feature not available: ${error.feature}`);
  } else {
    // 其他错误：记录日志
    console.error('Unexpected error:', error);
    showUserError('An unexpected error occurred.');
  }
}
```

---

### 2. 重试策略

```typescript
import { withRetry } from '@weisyn/client-sdk-js/utils/retry';

// ✅ 自定义重试逻辑
const result = await withRetry(
  async () => {
    return await criticalOperation();
  },
  {
    maxRetries: 5,
    initialDelay: 1000,
    retryable: (error) => {
      // 只重试网络错误，不重试业务错误
      return error instanceof NetworkError;
    },
    onRetry: (attempt, error) => {
      console.warn(`Retry ${attempt}:`, error.message);
    },
  }
);
```

---

## 📊 监控与日志

### 1. 请求监控

```typescript
// ✅ 记录请求耗时
const startTime = Date.now();
try {
  const result = await client.call('wes_getBalance', [addressHex]);
  const duration = Date.now() - startTime;
  console.log(`Request took ${duration}ms`);
} catch (error) {
  const duration = Date.now() - startTime;
  console.error(`Request failed after ${duration}ms:`, error);
}
```

### 2. 进度监控

```typescript
// ✅ 使用进度回调
await batchQuery(items, queryFn, {
  onProgress: (progress) => {
    // 更新 UI 进度条
    updateProgressBar(progress.percentage);
    
    // 记录进度日志
    console.log(`Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`);
  },
});
```

---

## 🌐 浏览器环境最佳实践

### 1. 环境检测

```typescript
import { getEnvironment, getEnvironmentInfo } from '@weisyn/client-sdk-js/utils/browser';

// ✅ 检测运行环境
const env = getEnvironment();
if (env === 'browser') {
  // 浏览器特定逻辑
  console.log('Running in browser');
} else if (env === 'node') {
  // Node.js 特定逻辑
  console.log('Running in Node.js');
}

// ✅ 检查功能支持
const info = getEnvironmentInfo();
if (!info.supportsWebCrypto) {
  showUserError('Your browser does not support Web Crypto API');
}
```

---

### 2. 文件上传

```typescript
// ✅ 浏览器文件上传最佳实践
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = '.wasm'; // 限制文件类型

fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // 1. 验证文件大小
  const maxSize = 100 * 1024 * 1024; // 100MB
  if (file.size > maxSize) {
    alert('File too large');
    return;
  }

  // 2. 验证文件类型
  if (!file.name.endsWith('.wasm')) {
    alert('Invalid file type');
    return;
  }

  // 3. 读取文件内容
  try {
    const arrayBuffer = await file.arrayBuffer();
    const content = new Uint8Array(arrayBuffer);

    // 4. 显示进度
    showProgress('Uploading...');

    // 5. 部署资源
    const result = await resourceService.deployContract({
      from: wallet.address,
      wasmContent: content,
      contractName: file.name,
    });

    showSuccess(`Contract deployed: ${result.txHash}`);
  } catch (error) {
    showError(`Deployment failed: ${error.message}`);
  } finally {
    hideProgress();
  }
});
```

---

## 🔄 异步操作最佳实践

### 1. Promise 链式调用

```typescript
// ✅ 使用 async/await（推荐）
async function transferAndCheck() {
  try {
    const result = await tokenService.transfer(request, wallet);
    const balance = await tokenService.getBalance(wallet.address, null);
    return { result, balance };
  } catch (error) {
    console.error('Transfer failed:', error);
    throw error;
  }
}

// ⚠️ 避免过度嵌套的 Promise
tokenService.transfer(request, wallet)
  .then(result => {
    tokenService.getBalance(wallet.address, null)
      .then(balance => {
        // 嵌套过深，难以维护
      });
  });
```

---

### 2. 并发控制

```typescript
import { parallelExecute } from '@weisyn/client-sdk-js/utils/batch';

// ✅ 使用并行执行工具（限制并发）
const results = await parallelExecute(
  items,
  async (item) => await processItem(item),
  5 // 最多5个并发
);

// ❌ 避免无限制并发
const promises = items.map(item => processItem(item));
await Promise.all(promises); // 可能导致资源耗尽
```

---

## 📚 代码组织最佳实践

### 1. 服务初始化

```typescript
// ✅ 统一初始化服务
import { Client } from '@weisyn/client-sdk-js';
import { TokenService, StakingService } from '@weisyn/client-sdk-js/services';

const client = new Client({
  endpoint: 'https://node.example.com',
  protocol: 'http',
});

const wallet = await Wallet.fromPrivateKey(privateKeyHex);

// 创建服务实例
const tokenService = new TokenService(client, wallet);
const stakingService = new StakingService(client, wallet);

// 或者使用默认 wallet
const tokenService = new TokenService(client, wallet);
// 后续调用可以不传 wallet
await tokenService.transfer(request); // 使用默认 wallet
```

---

### 2. 错误处理封装

```typescript
// ✅ 封装错误处理
async function safeTransfer(request: TransferRequest, wallet: Wallet): Promise<TransferResult | null> {
  try {
    return await tokenService.transfer(request, wallet);
  } catch (error) {
    if (error instanceof ValidationError) {
      // 参数错误：返回 null，不抛出
      console.error('Validation error:', error.message);
      return null;
    }
    // 其他错误：重新抛出
    throw error;
  }
}
```

---

## 🎨 UI/UX 最佳实践

### 1. 加载状态

```typescript
// ✅ 显示加载状态
async function handleTransfer() {
  setLoading(true);
  try {
    const result = await tokenService.transfer(request, wallet);
    showSuccess(`Transfer successful: ${result.txHash}`);
  } catch (error) {
    showError(`Transfer failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
}
```

---

### 2. 用户确认

```typescript
// ✅ 重要操作前确认
async function handleUnstake() {
  const confirmed = await confirmDialog(
    `Unstake ${amount} tokens? This action cannot be undone.`
  );
  
  if (!confirmed) {
    return;
  }

  try {
    const result = await stakingService.unstake(request, wallet);
    showSuccess(`Unstake successful: ${result.txHash}`);
  } catch (error) {
    showError(`Unstake failed: ${error.message}`);
  }
}
```

---

## 📚 相关文档

- [API 参考](./API.md) - 完整 API 文档
- [浏览器兼容性](./BROWSER_COMPATIBILITY.md) - 浏览器使用指南
- [性能优化](./PERFORMANCE.md) - 性能优化建议
- [能力对比](./CAPABILITY_COMPARISON.md) - Go/JS SDK 对比

---

**最后更新**: 2025-11-17

