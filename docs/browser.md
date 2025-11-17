# 浏览器兼容性指南

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

WES Client SDK (JS/TS) 完全支持浏览器环境，但需要注意一些环境差异和最佳实践。

---

## 🔗 关联文档

- **快速开始**：[快速开始指南](./getting-started.md)
- **TypeScript 支持**：[TypeScript 指南](./typescript.md)

---

## 🌐 环境检测

### 检测当前环境

```typescript
import { getEnvironment } from '@weisyn/client-sdk-js';

const env = getEnvironment();
console.log(`当前环境: ${env}`); // 'node' | 'browser' | 'unknown'
```

### 检测功能支持

```typescript
import {
  supportsWebCrypto,
  supportsFileSystem,
} from '@weisyn/client-sdk-js';

if (supportsWebCrypto()) {
  console.log('支持 Web Crypto API');
}

if (supportsFileSystem()) {
  console.log('支持文件系统操作');
}
```

---

## 🔐 加密功能差异

### 同步 vs 异步

**Node.js 环境**：
```typescript
import { sha256, addressBytesToBase58 } from '@weisyn/client-sdk-js';

// 同步 API 可用
const hash = sha256(data);
const base58 = addressBytesToBase58(addressBytes);
```

**浏览器环境**：
```typescript
import {
  sha256Async,
  addressBytesToBase58Async,
} from '@weisyn/client-sdk-js';

// 必须使用异步 API
const hash = await sha256Async(data);
const base58 = await addressBytesToBase58Async(addressBytes);
```

### 地址转换

```typescript
// ✅ 浏览器环境：使用异步版本
import { addressBytesToBase58Async } from '@weisyn/client-sdk-js';

const base58 = await addressBytesToBase58Async(wallet.address);

// ❌ 浏览器环境：同步版本会抛错
// const base58 = addressBytesToBase58(wallet.address); // 错误！
```

---

## 📁 文件处理差异

### Node.js 环境

```typescript
import { ResourceService } from '@weisyn/client-sdk-js';

const resourceService = new ResourceService(client, wallet);

// 可以直接传入文件路径
await resourceService.deployStaticResource({
  from: wallet.address,
  filePath: '/path/to/file.png', // Node.js 支持
  mimeType: 'image/png',
}, wallet);
```

### 浏览器环境

```typescript
// 浏览器环境：必须传入 Uint8Array
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

// 读取文件为 Uint8Array
const fileContent = new Uint8Array(await file.arrayBuffer());

await resourceService.deployStaticResource({
  from: wallet.address,
  fileContent: fileContent, // 浏览器必须使用 fileContent
  mimeType: file.type,
}, wallet);
```

---

## 🌐 网络请求

### CORS 配置

浏览器环境需要确保 WES 节点支持 CORS：

```typescript
// 如果节点不支持 CORS，可以使用代理
const client = new Client({
  endpoint: '/api/wes', // 通过代理访问
  protocol: 'http',
});
```

### HTTPS/WSS

生产环境建议使用 HTTPS：

```typescript
const client = new Client({
  endpoint: 'https://node.weisyn.io', // HTTPS
  protocol: 'http',
});
```

---

## 🔒 安全考虑

### 私钥安全

```typescript
// ✅ 推荐：使用 Keystore 加密存储
const keystoreData = await Keystore.encrypt(wallet, password);
localStorage.setItem('keystore', JSON.stringify(keystoreData));

// ❌ 不推荐：明文存储私钥
// localStorage.setItem('privateKey', wallet.exportPrivateKey()); // 危险！
```

### 密码输入

```typescript
// ✅ 推荐：使用安全的密码输入组件
// 避免在 URL 或日志中暴露密码
const password = await promptPassword(); // 使用安全的密码输入
const wallet = await Keystore.decrypt(keystoreData, password);
```

---

## 📦 打包配置

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    fallback: {
      "crypto": false, // 使用 Web Crypto API
      "fs": false,     // 浏览器不支持文件系统
    },
  },
};
```

### Vite

```javascript
// vite.config.js
export default {
  resolve: {
    alias: {
      crypto: false,
      fs: false,
    },
  },
};
```

### Rollup

```javascript
// rollup.config.js
export default {
  external: ['crypto', 'fs'],
};
```

---

## 🎯 最佳实践

### 1. 环境检测

```typescript
import { getEnvironment } from '@weisyn/client-sdk-js';

const env = getEnvironment();

if (env === 'browser') {
  // 使用异步 API
  const base58 = await addressBytesToBase58Async(addressBytes);
} else {
  // 使用同步 API
  const base58 = addressBytesToBase58(addressBytes);
}
```

### 2. 文件上传

```typescript
// 浏览器环境文件上传
async function uploadFile(file: File, wallet: Wallet) {
  const resourceService = new ResourceService(client, wallet);
  
  // 读取文件
  const fileContent = new Uint8Array(await file.arrayBuffer());
  
  // 检查文件大小
  if (fileContent.length > 100 * 1024 * 1024) {
    throw new Error('文件太大，请使用分块上传');
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

### 3. 错误处理

```typescript
try {
  await tokenService.transfer({...}, wallet);
} catch (error) {
  if (error instanceof BrowserCompatibilityError) {
    console.error('浏览器兼容性错误:', error.message);
    // 提示用户使用支持的浏览器
  }
}
```

---

## 🔗 相关文档

- **[快速开始](./getting-started.md)** - 安装和配置
- **[TypeScript 指南](./typescript.md)** - TypeScript 支持
- **[故障排查](./troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

