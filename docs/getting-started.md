# 快速开始

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：draft
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK

---

## 📋 前置条件

### 1. 环境要求

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0（可选，但推荐）

### 2. WES 节点

确保你已经启动了一个 WES 节点。如果还没有，请参考：

- [WES 安装指南](https://github.com/weisyn/weisyn/blob/main/docs/tutorials/installation.md)

---

## 📦 安装

### 使用 npm

```bash
npm install @weisyn/client-sdk-js
```

### 使用 yarn

```bash
yarn add @weisyn/client-sdk-js
```

### 使用 pnpm

```bash
pnpm add @weisyn/client-sdk-js
```

---

## 🚀 第一个示例

### 完整代码

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

async function main() {
  // 1. 初始化客户端
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
    timeout: 30000,
  });

  // 2. 创建或导入钱包
  const wallet = await Wallet.create();
  // 或从私钥导入：const wallet = await Wallet.fromPrivateKey('0x...');

  // 3. 创建 Token 服务
  const tokenService = new TokenService(client, wallet);

  // 4. 执行转账
  const result = await tokenService.transfer({
    from: wallet.address,
    to: recipient.address,
    amount: BigInt(1000000), // 1 WES（假设 6 位小数）
    tokenId: null, // null 表示原生币
  }, wallet);

  console.log(`转账成功！交易哈希: ${result.txHash}`);
}

main().catch(console.error);
```

---

## 🔧 配置

### Client 配置

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545', // 节点端点
  protocol: 'http',                    // 协议：'http' | 'websocket'
  timeout: 30000,                      // 超时时间（毫秒）
  debug: false,                        // 调试模式
  retry: {                             // 重试配置（可选）
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
});
```

### 环境变量配置

```typescript
const endpoint = process.env.WES_NODE_ENDPOINT || 'http://localhost:8545';

const client = new Client({
  endpoint: endpoint,
  protocol: 'http',
});
```

---

## 📚 核心概念

### 1. Client

`Client` 是与 WES 节点通信的核心接口：

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});
```

### 2. Wallet

`Wallet` 提供密钥管理和签名功能：

```typescript
// 创建新钱包
const wallet = await Wallet.create();

// 从私钥导入
const wallet = await Wallet.fromPrivateKey('0x...');

// 获取地址
const address = wallet.address; // Uint8Array (20 bytes)
```

### 3. Services

业务服务提供高级 API：

```typescript
// Token 服务
const tokenService = new TokenService(client, wallet);
const result = await tokenService.transfer({...}, wallet);

// Staking 服务
const stakingService = new StakingService(client, wallet);
const result = await stakingService.stake({...}, wallet);
```

---

## 🌐 浏览器环境

### 基本使用

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/@weisyn/client-sdk-js/dist/index.umd.js"></script>
</head>
<body>
  <script>
    const { Client, TokenService, Wallet } = WESClientSDK;
    
    async function init() {
      const client = new Client({
        endpoint: 'http://localhost:8545',
        protocol: 'http',
      });
      
      const wallet = await Wallet.create();
      const tokenService = new TokenService(client, wallet);
      
      // 使用服务...
    }
    
    init();
  </script>
</body>
</html>
```

### 注意事项

1. **异步地址转换**：浏览器环境需要使用异步版本
   ```typescript
   import { addressBytesToBase58Async } from '@weisyn/client-sdk-js';
   const base58 = await addressBytesToBase58Async(addressBytes);
   ```

2. **文件读取**：浏览器环境需要使用 File API
   ```typescript
   const file = fileInput.files[0];
   const fileContent = new Uint8Array(await file.arrayBuffer());
   ```

---

## 🎯 下一步

- **[概述](./overview.md)** - 了解 SDK 视角的 WES 核心概念
- **[Token 指南](./guides/token.md)** - 学习 Token 服务的使用
- **[API 参考](./api/)** - 查看完整的 API 文档

---

## 🔗 相关文档

- **[WES 项目总览](https://github.com/weisyn/weisyn/blob/main/docs/overview.md)** - WES 核心概念和定位
- **[WES 系统架构](https://github.com/weisyn/weisyn/blob/main/docs/system/architecture/README.md)** - 完整的系统架构设计
- **[JSON-RPC API 参考](https://github.com/weisyn/weisyn/blob/main/docs/reference/api.md)** - 底层 API 接口文档

---

**最后更新**: 2025-11-17
