# API 参考文档

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：draft
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK（已归档）

---

## 📖 文档说明

本文档提供 WES Client SDK (JS/TS) 的完整 API 参考。

---

## 🎯 核心模块

### Client

WES 客户端接口，用于与 WES 节点通信。

#### 构造函数

```typescript
new Client(config: ClientConfig): Client
```

**参数**：
- `config`: 客户端配置

**示例**：
```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 30000,
  debug: false,
});
```

#### 方法

##### `call(method: string, params: any): Promise<any>`

调用 JSON-RPC 方法。

**参数**：
- `method`: JSON-RPC 方法名
- `params`: 方法参数

**返回**：Promise<any> - 方法返回结果

**示例**：
```typescript
const result = await client.call('wes_getChainInfo', []);
```

##### `sendRawTransaction(signedTxHex: string): Promise<SendTxResult>`

发送已签名的原始交易。

**参数**：
- `signedTxHex`: 已签名的交易（十六进制字符串）

**返回**：Promise<SendTxResult> - 交易提交结果

**示例**：
```typescript
const result = await client.sendRawTransaction('0x...');
console.log(result.txHash);
```

##### `subscribe(filter: EventFilter): Promise<EventSubscription>`

订阅事件（仅 WebSocket 客户端支持）。

**参数**：
- `filter`: 事件过滤器

**返回**：Promise<EventSubscription> - 事件订阅对象

**示例**：
```typescript
const subscription = await client.subscribe({
  topics: ['Transfer'],
});

subscription.on('event', (event) => {
  console.log('收到事件:', event);
});
```

##### `close(): Promise<void>`

关闭连接。

---

### Wallet

钱包类，提供密钥管理和交易签名功能。

#### 静态方法

##### `create(): Promise<Wallet>`

创建新钱包。

**返回**：Promise<Wallet> - 新创建的钱包

**示例**：
```typescript
const wallet = await Wallet.create();
console.log(wallet.getAddressHex());
```

##### `fromPrivateKey(privateKeyHex: string): Promise<Wallet>`

从私钥创建钱包。

**参数**：
- `privateKeyHex`: 私钥（十六进制字符串，可选 0x 前缀）

**返回**：Promise<Wallet> - 钱包实例

**示例**：
```typescript
const wallet = await Wallet.fromPrivateKey('0x...');
```

#### 实例方法

##### `signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>`

签名交易。

**参数**：
- `unsignedTx`: 未签名交易（字节数组）

**返回**：Promise<Uint8Array> - 签名（64 字节）

##### `signMessage(message: Uint8Array): Promise<Uint8Array>`

签名消息。

**参数**：
- `message`: 消息（字节数组）

**返回**：Promise<Uint8Array> - 签名（64 字节）

##### `exportPrivateKey(): string`

导出私钥（谨慎使用）。

**返回**：string - 私钥（十六进制字符串）

##### `getAddressHex(): string`

获取地址的十六进制字符串。

**返回**：string - 地址（0x + 40 个十六进制字符）

---

### TokenService

Token 服务，提供代币转账、铸造、销毁等功能。

#### 构造函数

```typescript
new TokenService(client: Client, wallet?: Wallet): TokenService
```

**参数**：
- `client`: WES 客户端
- `wallet`: 可选，默认钱包

#### 方法

##### `transfer(request: TransferRequest, wallet?: Wallet): Promise<TransferResult>`

单笔转账。

**参数**：
- `request`: 转账请求
  - `from`: 发送方地址（20 字节）
  - `to`: 接收方地址（20 字节）
  - `amount`: 转账金额（bigint 或 number）
  - `tokenId`: 代币 ID（20 字节，null 表示原生币）
- `wallet`: 可选，用于签名的钱包

**返回**：Promise<TransferResult> - 转账结果

**示例**：
```typescript
const result = await tokenService.transfer({
  from: wallet.address,
  to: recipientAddress,
  amount: 1000000,
  tokenId: null, // 原生币
});
```

##### `getBalance(address: Uint8Array, tokenId: Uint8Array | null): Promise<bigint>`

查询余额。

**参数**：
- `address`: 地址（20 字节）
- `tokenId`: 代币 ID（null 表示原生币）

**返回**：Promise<bigint> - 余额

---

## 🔧 工具函数

### 地址工具

#### `addressToHex(address: Uint8Array): string`

将地址转换为十六进制字符串。

#### `hexToAddress(hex: string): Uint8Array`

将十六进制字符串转换为地址。

#### `isValidAddress(address: Uint8Array | string): boolean`

验证地址格式。

### 十六进制工具

#### `bytesToHex(bytes: Uint8Array): string`

将字节数组转换为十六进制字符串。

#### `hexToBytes(hex: string): Uint8Array`

将十六进制字符串转换为字节数组。

#### `isValidHex(hex: string): boolean`

验证十六进制字符串格式。

---

## 📝 类型定义

### ClientConfig

```typescript
interface ClientConfig {
  endpoint: string;        // 节点端点 URL
  protocol: 'http' | 'websocket'; // 传输协议
  timeout?: number;        // 请求超时时间（毫秒）
  debug?: boolean;         // 是否启用调试日志
  headers?: Record<string, string>; // 自定义请求头
}
```

### TransferRequest

```typescript
interface TransferRequest {
  from: Uint8Array;       // 发送方地址（20 字节）
  to: Uint8Array;         // 接收方地址（20 字节）
  amount: bigint | number; // 转账金额
  tokenId: Uint8Array | null; // 代币 ID（null 表示原生币）
}
```

### TransferResult

```typescript
interface TransferResult {
  txHash: string;         // 交易哈希
  success: boolean;       // 是否成功
  blockHeight?: number;   // 区块高度
}
```

---

## 🚀 新增功能

### 请求重试机制

SDK 的 HTTP 客户端内置了可配置的请求重试机制，提高应用程序在网络不稳定时的健壮性。

**配置示例**：
```typescript
import { Client } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 30000,
  retry: {
    maxRetries: 5,              // 最大重试次数
    initialDelay: 1000,         // 初始延迟（毫秒）
    maxDelay: 10000,           // 最大延迟（毫秒）
    backoffMultiplier: 2.0,    // 退避倍数
    retryable: (error) => {     // 自定义判断错误是否可重试
      return error.message.includes('Network Error');
    },
    onRetry: (attempt, error) => {
      console.warn(`Retry attempt ${attempt}:`, error.message);
    },
  },
});
```

详细说明请参考 [性能优化指南](./PERFORMANCE.md)。

---

### 批量操作工具

SDK 提供了批量查询和批量操作工具，提升性能。

**批量查询示例**：
```typescript
import { batchQuery } from '@weisyn/client-sdk-js/utils/batch';

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
```

**并行执行示例**：
```typescript
import { parallelExecute } from '@weisyn/client-sdk-js/utils/batch';

const results = await parallelExecute(
  items,
  async (item) => await processItem(item),
  5 // 并发数量
);
```

详细说明请参考 [性能优化指南](./PERFORMANCE.md)。

---

### 异步地址转换（浏览器支持）

SDK 提供了异步版本的地址转换函数，支持浏览器环境。

**示例**：
```typescript
import {
  addressBytesToBase58Async,
  addressHexToBase58Async,
} from '@weisyn/client-sdk-js/utils/address';

// 浏览器环境使用异步版本
const base58Addr = await addressBytesToBase58Async(addressBytes);
const base58FromHex = await addressHexToBase58Async('0x1234...');
```

详细说明请参考 [浏览器兼容性指南](./BROWSER_COMPATIBILITY.md)。

---

### 大文件处理工具

SDK 提供了大文件处理工具，支持分块处理和流式读取。

**浏览器环境示例**：
```typescript
import { readFileAsStream, processFileInChunks } from '@weisyn/client-sdk-js/utils/file';

const file = fileInput.files?.[0];
const data = await readFileAsStream(file, (chunk, index) => {
  console.log(`Read chunk ${index}`);
});

await processFileInChunks(data, async (chunk, index) => {
  return await processChunk(chunk);
}, {
  chunkSize: 5 * 1024 * 1024, // 5MB
  concurrency: 3,
  onProgress: (progress) => {
    console.log(`Processing: ${progress.percentage}%`);
  },
});
```

详细说明请参考 [性能优化指南](./PERFORMANCE.md)。

---

## 🔗 相关资源

- [README](../README.md) - 项目说明
- [项目结构](../PROJECT_STRUCTURE.md) - 项目结构说明
- [最佳实践指南](./BEST_PRACTICES.md) - 使用最佳实践
- [浏览器兼容性指南](./BROWSER_COMPATIBILITY.md) - 浏览器使用指南
- [性能优化指南](./PERFORMANCE.md) - 性能优化建议
- [能力对比](./CAPABILITY_COMPARISON.md) - Go/JS SDK 对比
- [Go Client SDK](https://github.com/weisyn/client-sdk-go) - Go 版本 SDK

---

**最后更新**: 2025-11-17

