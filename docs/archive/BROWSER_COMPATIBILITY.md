# 浏览器兼容性指南

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

WES Client SDK (JS/TS) 支持 Node.js 和浏览器环境，但某些功能在不同环境中的行为可能有所不同。本文档说明浏览器兼容性注意事项和最佳实践。

---

## 🌐 环境检测

SDK 提供了环境检测工具：

```typescript
import { getEnvironment, getEnvironmentInfo } from '@weisyn/client-sdk-js/utils/browser';

// 检测当前环境
const env = getEnvironment(); // 'node' | 'browser' | 'unknown'

// 获取详细环境信息
const info = getEnvironmentInfo();
console.log(info);
// {
//   environment: 'browser',
//   supportsWebCrypto: true,
//   supportsNodeCrypto: false,
//   supportsFileSystem: false,
//   browserInfo: { userAgent: '...' }
// }
```

---

## ⚠️ 功能兼容性

### 1. 加密操作

#### SHA256 哈希

**Node.js 环境**：
- ✅ 支持同步 `sha256()` 函数
- ✅ 使用 Node.js `crypto` 模块

**浏览器环境**：
- ⚠️ 同步 `sha256()` 函数**不支持**（会抛出错误）
- ✅ 支持异步 `sha256Async()` 函数
- ✅ 使用 Web Crypto API

**示例**：
```typescript
import { sha256, sha256Async } from '@weisyn/client-sdk-js/utils/address';

// Node.js 环境
const hash = sha256(data); // 同步

// 浏览器环境
const hash = await sha256Async(data); // 异步
```

#### 地址转换

**Node.js 环境**：
- ✅ 完全支持 Base58Check 编码/解码
- ✅ 使用同步 SHA256

**浏览器环境**：
- ⚠️ Base58Check 编码/解码**可能失败**（如果使用同步 SHA256）
- 💡 **建议**：在浏览器环境中，地址转换应在服务端完成，或使用异步版本

---

### 2. 文件操作

#### 文件读取

**Node.js 环境**：
- ✅ 支持通过文件路径读取文件
- ✅ 使用 `fs.promises.readFile`

**浏览器环境**：
- ❌ **不支持**文件路径读取
- ✅ 支持直接传入文件内容（`Uint8Array`）

**示例**：
```typescript
// Node.js 环境
await resourceService.deployContract({
  from: address,
  wasmPath: './contract.wasm', // ✅ 支持
  contractName: 'MyContract',
});

// 浏览器环境
const wasmContent = await file.arrayBuffer(); // File API
await resourceService.deployContract({
  from: address,
  wasmContent: new Uint8Array(wasmContent), // ✅ 支持
  contractName: 'MyContract',
});
```

#### Base64 编码

**Node.js 环境**：
- ✅ 使用 `Buffer.from().toString('base64')`
- ✅ 支持任意大小的数据

**浏览器环境**：
- ✅ 使用 `btoa()` API
- ✅ 自动处理大数组（分块编码）
- ⚠️ 对于超大文件（>100MB），可能性能较差

---

### 3. 网络请求

**Node.js 和浏览器环境**：
- ✅ 完全支持 HTTP/WebSocket 连接
- ✅ 使用 `axios`（HTTP）和 `ws`（WebSocket）

---

## 🔧 最佳实践

### 1. 环境检测

在关键功能前检测环境：

```typescript
import { getEnvironment, requireFeature, supportsNodeCrypto } from '@weisyn/client-sdk-js/utils/browser';

// 方式1：检测环境
if (getEnvironment() === 'browser') {
  // 浏览器特定逻辑
}

// 方式2：检查功能支持
requireFeature('Node.js crypto', supportsNodeCrypto, 'SHA256 requires Node.js');
```

### 2. 错误处理

使用 SDK 提供的错误类型：

```typescript
import { BrowserCompatibilityError } from '@weisyn/client-sdk-js/client/errors';

try {
  // 某些操作
} catch (error) {
  if (error instanceof BrowserCompatibilityError) {
    console.error(`Feature "${error.feature}" not available in ${error.environment}`);
    // 提供降级方案
  }
}
```

### 3. 文件上传（浏览器）

在浏览器中上传文件：

```typescript
// HTML
<input type="file" id="fileInput" />

// TypeScript
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
fileInput.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;

  // 读取文件内容
  const arrayBuffer = await file.arrayBuffer();
  const content = new Uint8Array(arrayBuffer);

  // 部署资源
  await resourceService.deployStaticResource({
    from: wallet.address,
    fileContent: content, // ✅ 使用 fileContent
    mimeType: file.type,
  });
});
```

---

## 📊 兼容性矩阵

| 功能 | Node.js | 浏览器 | 说明 |
|------|---------|--------|------|
| **加密操作** |
| SHA256（同步） | ✅ | ❌ | 浏览器需使用异步版本 |
| SHA256（异步） | ✅ | ✅ | 完全支持 |
| 地址转换 | ✅ | ⚠️ | 浏览器中可能失败 |
| **文件操作** |
| 文件路径读取 | ✅ | ❌ | 浏览器需使用文件内容 |
| Base64 编码 | ✅ | ✅ | 完全支持 |
| **网络** |
| HTTP 请求 | ✅ | ✅ | 完全支持 |
| WebSocket | ✅ | ✅ | 完全支持 |
| **业务功能** |
| Token Service | ✅ | ✅ | 完全支持 |
| Staking Service | ✅ | ✅ | 完全支持 |
| Market Service | ✅ | ✅ | 完全支持 |
| Governance Service | ✅ | ✅ | 完全支持 |
| Resource Service | ✅ | ⚠️ | 文件读取需特殊处理 |

---

## 🐛 常见问题

### Q1: 在浏览器中使用地址转换失败？

**A**: 浏览器环境中，地址转换使用的 SHA256 是同步的，但 Web Crypto API 是异步的。建议：
1. 在服务端完成地址转换
2. 使用预转换的地址
3. 等待异步版本实现

### Q2: 如何上传大文件？

**A**: 对于大文件（>100MB），建议：
1. 分块上传
2. 使用流式处理
3. 在服务端完成文件处理

### Q3: 浏览器中如何读取本地文件？

**A**: 使用 HTML5 File API：

```typescript
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  const arrayBuffer = await file.arrayBuffer();
  const content = new Uint8Array(arrayBuffer);
  // 使用 content
};
```

---

## 📚 相关文档

- [API 参考](./API.md)
- [使用示例](../examples/)
- [项目结构](../PROJECT_STRUCTURE.md)

---

**最后更新**: 2025-11-17

