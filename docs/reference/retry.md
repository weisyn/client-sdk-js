# 重试机制参考

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

SDK 内置了请求重试机制，可以在网络不稳定或节点暂时性故障时自动重试，提高应用程序的健壮性。

---

## 🔗 关联文档

- **性能优化**：[性能优化指南](../reference/performance.md)（待创建）
- **故障排查**：[故障排查指南](../troubleshooting.md)

---

## ⚙️ 配置重试

### 基本配置

```typescript
import { Client } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 3,        // 最大重试 3 次
    initialDelay: 500,    // 首次重试延迟 500ms
    maxDelay: 10000,      // 最大延迟 10 秒
    backoffMultiplier: 2, // 退避乘数（每次延迟翻倍）
  },
});
```

### 自定义重试条件

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
  },
});
```

### 重试回调

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 3,
    initialDelay: 500,
    onRetry: (attempt, error) => {
      console.warn(`重试第 ${attempt} 次: ${error.message}`);
      // 可以在这里记录日志、发送监控事件等
    },
  },
});
```

---

## 🔄 重试策略

### 指数退避

SDK 使用指数退避策略：

```
第 1 次重试：延迟 500ms
第 2 次重试：延迟 1000ms (500 * 2)
第 3 次重试：延迟 2000ms (1000 * 2)
第 4 次重试：延迟 4000ms (2000 * 2)
第 5 次重试：延迟 8000ms (4000 * 2)
最大延迟：10000ms（受 maxDelay 限制）
```

### 可重试错误

默认情况下，以下错误会被重试：

- ✅ 网络错误（连接超时、DNS 解析失败等）
- ✅ HTTP 5xx 错误（服务器内部错误）
- ✅ 临时性错误（如节点暂时不可用）

### 不可重试错误

以下错误不会被重试：

- ❌ 参数验证错误（4xx）
- ❌ 余额不足等业务错误
- ❌ 签名错误
- ❌ 权限错误

---

## 📊 配置参数

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

## 🎯 使用示例

### 示例 1：默认重试配置

```typescript
// 使用默认配置（重试 3 次，指数退避）
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {}, // 使用默认值
});
```

### 示例 2：高可用配置

```typescript
// 适合生产环境的高可用配置
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryable: (error) => {
      // 只重试网络错误和 5xx 错误
      if (error instanceof NetworkError) {
        return true;
      }
      if (error.response && error.response.status >= 500) {
        return true;
      }
      return false;
    },
    onRetry: (attempt, error) => {
      // 记录重试日志
      logger.warn(`Request retry ${attempt}/${5}: ${error.message}`);
    },
  },
});
```

### 示例 3：快速失败配置

```typescript
// 快速失败，不重试
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 0, // 不重试
  },
});
```

---

## 🔍 错误处理

### 重试后的错误

如果所有重试都失败，会抛出最后一次的错误：

```typescript
try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  // 这是最后一次重试失败后的错误
  console.error('所有重试都失败:', error.message);
}
```

### 检查重试次数

```typescript
// 可以通过错误对象获取重试信息（如果 SDK 提供）
try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  if (error.retryCount) {
    console.log(`重试了 ${error.retryCount} 次后失败`);
  }
}
```

---

## 📈 性能考虑

### 重试延迟对性能的影响

- **短延迟**：快速响应，但可能增加服务器负载
- **长延迟**：减少服务器负载，但用户体验较差

**推荐配置**：
- 开发环境：`initialDelay: 500`, `maxDelay: 5000`
- 生产环境：`initialDelay: 1000`, `maxDelay: 10000`

### 并发请求

重试机制对每个请求独立工作，不会影响并发性能：

```typescript
// 多个请求并发执行，每个请求独立重试
const promises = [
  client.call('wes_blockNumber', []),
  client.call('wes_getUTXO', [address1]),
  client.call('wes_getUTXO', [address2]),
];

await Promise.all(promises);
```

---

## 🔗 相关文档

- **[Client API](../api/client.md)** - 客户端接口
- **[故障排查](../troubleshooting.md)** - 常见问题
- **[性能优化](../reference/performance.md)** - 性能优化指南（待创建）

---

**最后更新**: 2025-11-17

