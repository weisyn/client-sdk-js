# 事件订阅示例

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

使用 WebSocket 订阅 WES 链上事件的示例。

---

## 💻 完整代码

```typescript
import { Client, Wallet } from '@weisyn/client-sdk-js';

async function eventSubscriptionExample() {
  // 1. 创建 WebSocket 客户端
  const wsClient = new Client({
    endpoint: 'ws://localhost:8081',
    protocol: 'websocket',
  });

  // 2. 订阅 Transfer 事件
  const subscription = await wsClient.subscribe({
    topics: ['Transfer'],
    from: null, // 可选：过滤发送方
    to: null,   // 可选：过滤接收方
  });

  console.log('已订阅 Transfer 事件');

  // 3. 监听事件
  subscription.on('event', (event) => {
    console.log('收到事件:');
    console.log(`主题: ${event.topic}`);
    console.log(`数据: ${JSON.stringify(event.data)}`);
    console.log(`区块高度: ${event.blockNumber}`);
    console.log(`交易哈希: ${event.txHash}`);
  });

  // 4. 监听错误
  subscription.on('error', (error) => {
    console.error('订阅错误:', error);
  });

  // 5. 保持连接（实际应用中）
  // 可以设置定时器或其他逻辑来保持连接

  // 6. 取消订阅（示例：10 秒后取消）
  setTimeout(() => {
    subscription.unsubscribe();
    console.log('已取消订阅');
    wsClient.close();
  }, 10000);
}

// 运行示例
eventSubscriptionExample().catch(console.error);
```

---

## 🔍 代码说明

### 1. WebSocket 客户端

```typescript
const wsClient = new Client({
  endpoint: 'ws://localhost:8081', // WebSocket 端点
  protocol: 'websocket',            // 使用 WebSocket 协议
});
```

### 2. 订阅事件

```typescript
const subscription = await wsClient.subscribe({
  topics: ['Transfer', 'Mint'], // 订阅的事件主题
  from: fromAddress,             // 可选：过滤发送方
  to: toAddress,                 // 可选：过滤接收方
});
```

**支持的事件主题**：
- `Transfer` - 转账事件
- `Mint` - 铸造事件
- `Burn` - 销毁事件
- `Stake` - 质押事件
- `Unstake` - 解质押事件
- 等等...

### 3. 事件监听

```typescript
subscription.on('event', (event) => {
  // event.topic - 事件主题
  // event.data - 事件数据
  // event.blockNumber - 区块高度
  // event.txHash - 交易哈希
});
```

### 4. 取消订阅

```typescript
subscription.unsubscribe();
wsClient.close();
```

---

## 🎯 运行示例

```bash
# 1. 确保 WES 节点支持 WebSocket
# 2. 安装依赖
npm install @weisyn/client-sdk-js

# 3. 创建示例文件
# event-subscription.ts

# 4. 运行
npx ts-node event-subscription.ts
```

---

## ⚠️ 注意事项

1. **WebSocket 端点**：确保节点支持 WebSocket 连接
2. **连接保持**：WebSocket 连接需要保持活跃
3. **错误处理**：需要处理连接断开和重连
4. **事件过滤**：使用 `from` 和 `to` 参数可以过滤特定事件

---

## 🔗 相关文档

- **[Client API](../api/client.md)** - Client API 参考
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

