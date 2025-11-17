# TypeScript 支持

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

WES Client SDK 完全使用 TypeScript 编写，提供完整的类型定义和类型安全。

---

## 📦 类型定义

### 安装

SDK 已包含类型定义，无需额外安装：

```bash
npm install @weisyn/client-sdk-js
```

### 类型导出

```typescript
import {
  Client,
  ClientConfig,
  Wallet,
  TokenService,
  TransferRequest,
  TransferResult,
  // ... 更多类型
} from '@weisyn/client-sdk-js';
```

---

## 🎯 类型安全

### 接口类型

```typescript
// Client 接口
interface IClient {
  call(method: string, params: any): Promise<any>;
  sendRawTransaction(signedTxHex: string): Promise<SendTxResult>;
  subscribe(filter: EventFilter): Promise<EventSubscription>;
  close(): Promise<void>;
}

// Wallet 接口
interface IWallet {
  address: Uint8Array;
  publicKey: Uint8Array;
  signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}
```

### 请求/响应类型

```typescript
// Transfer 请求类型
interface TransferRequest {
  from: Uint8Array;      // 20 字节地址
  to: Uint8Array;        // 20 字节地址
  amount: bigint | number;
  tokenId: Uint8Array | null; // null 表示原生币
}

// Transfer 响应类型
interface TransferResult {
  txHash: string;
  success: boolean;
}
```

---

## 🔧 TypeScript 配置

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

---

## 📚 类型使用示例

### 类型推断

```typescript
import { TokenService } from '@weisyn/client-sdk-js';

const tokenService = new TokenService(client, wallet);

// TypeScript 会自动推断返回类型
const result = await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000000),
  tokenId: null,
}, wallet);

// result 的类型是 TransferResult
console.log(result.txHash); // ✅ 类型安全
// console.log(result.invalidField); // ❌ TypeScript 错误
```

### 泛型类型

```typescript
import { batchQuery } from '@weisyn/client-sdk-js';

// TypeScript 会推断泛型类型
const balances = await batchQuery(
  addresses, // T = Uint8Array
  async (address) => {
    return await tokenService.getBalance(address, null);
  }
); // R = bigint

// balances 的类型是 bigint[]
```

---

## 🎨 自定义类型

### 扩展接口

```typescript
import { IClient } from '@weisyn/client-sdk-js';

// 扩展 Client 接口
interface ExtendedClient extends IClient {
  // 添加自定义方法
  customMethod(): Promise<void>;
}
```

### 类型守卫

```typescript
import { NetworkError, TransactionError } from '@weisyn/client-sdk-js';

function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  if (isNetworkError(error)) {
    console.error('网络错误:', error.message);
  }
}
```

---

## 🔍 类型检查

### 严格模式

推荐启用 TypeScript 严格模式：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### 类型错误示例

```typescript
// ❌ 类型错误：amount 应该是 bigint | number
await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: '1000000', // 错误：字符串不是 bigint | number
  tokenId: null,
}, wallet);

// ✅ 正确
await tokenService.transfer({
  from: wallet.address,
  to: recipient.address,
  amount: BigInt(1000000), // 正确
  tokenId: null,
}, wallet);
```

---

## 📦 打包配置

### Tree Shaking

TypeScript 类型定义支持 tree shaking：

```typescript
// 只导入需要的类型
import type { TransferRequest, TransferResult } from '@weisyn/client-sdk-js';

// 运行时导入
import { TokenService } from '@weisyn/client-sdk-js';
```

### 类型声明文件

SDK 提供完整的 `.d.ts` 类型声明文件：

```typescript
// node_modules/@weisyn/client-sdk-js/dist/index.d.ts
export interface IClient { ... }
export class Client implements IClient { ... }
// ...
```

---

## 🔗 相关文档

- **[快速开始](./getting-started.md)** - 安装和配置
- **[浏览器兼容性](./browser.md)** - 浏览器环境使用
- **[API 参考](./api/)** - 完整 API 文档

---

**最后更新**: 2025-11-17

