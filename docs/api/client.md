# Client API 参考

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

`Client` 是 SDK 的核心接口，负责与 WES 节点通信。它封装了 JSON-RPC 调用、请求重试、错误处理等功能。

---

## 🔗 关联文档

- **底层 API**：[WES JSON-RPC API 参考](https://github.com/weisyn/weisyn/blob/main/docs/reference/api.md)
- **架构说明**：[SDK 架构设计](../architecture.md)

---

## 📦 导入

```typescript
import { Client, ClientConfig } from '@weisyn/client-sdk-js';
```

---

## 🏗️ Client 接口

### IClient

```typescript
interface IClient {
  /**
   * 调用 JSON-RPC 方法
   * @param method 方法名（如 'wes_getUTXO'）
   * @param params 参数数组
   * @returns 返回结果
   */
  call(method: string, params: any): Promise<any>;

  /**
   * 发送已签名的原始交易
   * @param signedTxHex 已签名的交易（十六进制字符串）
   * @returns 交易提交结果
   */
  sendRawTransaction(signedTxHex: string): Promise<SendTxResult>;

  /**
   * 订阅事件（WebSocket 支持）
   * @param filter 事件过滤器
   * @returns 事件订阅对象
   */
  subscribe(filter: EventFilter): Promise<EventSubscription>;

  /**
   * 关闭连接
   */
  close(): Promise<void>;
}
```

---

## ⚙️ 配置

### ClientConfig

```typescript
interface ClientConfig {
  /** 节点端点（如 'http://localhost:8545'） */
  endpoint: string;
  
  /** 传输协议 */
  protocol: 'http' | 'websocket';
  
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;
  
  /** 是否启用调试日志，默认 false */
  debug?: boolean;
  
  /** 重试配置（可选） */
  retry?: RetryConfig;
}
```

### RetryConfig

```typescript
interface RetryConfig {
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  
  /** 首次重试延迟（毫秒），默认 500 */
  initialDelay?: number;
  
  /** 最大重试延迟（毫秒），默认 10000 */
  maxDelay?: number;
  
  /** 退避乘数，默认 2 */
  backoffMultiplier?: number;
  
  /** 判断错误是否可重试的函数 */
  retryable?: (error: any) => boolean;
  
  /** 重试回调函数 */
  onRetry?: (attempt: number, error: any) => void;
}
```

---

## 🚀 使用示例

### 基本使用

```typescript
import { Client } from '@weisyn/client-sdk-js';

// 创建客户端
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 30000,
});

// 调用 JSON-RPC 方法
const blockNumber = await client.call('wes_blockNumber', []);

// 查询 UTXO
const utxos = await client.call('wes_getUTXO', [addressBase58]);

// 关闭连接
await client.close();
```

### 配置重试机制

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 5,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryable: (error) => {
      // 只重试网络错误或 5xx 错误
      return error.message?.includes('Network Error') || 
             (error.response && error.response.status >= 500);
    },
    onRetry: (attempt, error) => {
      console.warn(`重试第 ${attempt} 次: ${error.message}`);
    },
  },
});
```

### WebSocket 事件订阅

```typescript
const wsClient = new Client({
  endpoint: 'ws://localhost:8081',
  protocol: 'websocket',
});

const subscription = await wsClient.subscribe({
  topics: ['Transfer', 'Mint'],
  from: fromAddress,
  to: toAddress,
});

subscription.on('event', (event) => {
  console.log('收到事件:', event);
});

// 取消订阅
subscription.unsubscribe();
```

---

## 📚 常用 JSON-RPC 方法

### 查询方法

| 方法 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `wes_blockNumber` | 获取当前区块高度 | `[]` | `number` |
| `wes_getUTXO` | 查询 UTXO | `[address]` | `{ utxos: [...] }` |
| `wes_getTransactionByHash` | 查询交易 | `[txHash]` | `{ hash, status, ... }` |
| `wes_getResource` | 查询资源 | `[resourceId]` | `{ type, size, ... }` |

### 交易方法

| 方法 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `wes_buildTransaction` | 构建交易 | `[draft]` | `{ unsigned_tx, ... }` |
| `wes_computeSignatureHashFromDraft` | 计算签名哈希 | `[draft, inputIndex]` | `string` |
| `wes_finalizeTransactionFromDraft` | 完成交易 | `[draft, signatures, ...]` | `{ signed_tx }` |
| `wes_sendRawTransaction` | 发送交易 | `[signedTxHex]` | `{ tx_hash }` |

### 合约方法

| 方法 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `wes_callContract` | 调用合约 | `[contractAddr, method, params, ...]` | `{ result, unsigned_tx? }` |

> 💡 **完整 API 列表**：详见 [WES JSON-RPC API 参考](https://github.com/weisyn/weisyn/blob/main/docs/reference/api.md)

---

## 🔍 错误处理

### 错误类型

```typescript
// NetworkError - 网络错误
try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  if (error instanceof NetworkError) {
    console.error('网络错误:', error.message);
  }
}

// JSONRPCError - JSON-RPC 错误
try {
  await client.call('wes_getUTXO', ['invalid_address']);
} catch (error) {
  if (error instanceof JSONRPCError) {
    console.error('RPC 错误:', error.code, error.message);
  }
}
```

### 错误分类

| 错误类型 | 说明 | 是否可重试 |
|---------|------|-----------|
| `NetworkError` | 网络连接错误 | ✅ 是 |
| `JSONRPCError` | JSON-RPC 协议错误 | ⚠️ 部分（5xx 可重试） |
| `TransactionError` | 交易错误（余额不足等） | ❌ 否 |
| `ValidationError` | 参数验证错误 | ❌ 否 |

---

## 🔗 相关文档

- **[Wallet API](./wallet.md)** - 钱包功能
- **[Services API](./services.md)** - 业务服务
- **[重试机制](../reference/retry.md)** - 重试配置详解
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

