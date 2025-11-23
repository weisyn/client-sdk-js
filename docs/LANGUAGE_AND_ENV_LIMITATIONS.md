# Client SDK JS/TS - 语言与环境限制

**版本**: v1.0.0  
**最后更新**: 2025-01-23

---

## 📋 文档定位

> 📌 **重要说明**：本文档说明 **TypeScript/JavaScript 特有的限制和最佳实践**。

**本文档目标**：
- 说明浏览器和 Node.js 环境的差异
- 说明 TypeScript 类型系统的使用
- 说明 Bundler 配置（Webpack、Vite 等）
- 说明 Tree Shaking 支持

---

## 🌐 环境支持

### 浏览器环境

**支持的浏览器**：
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

**限制**：
- ❌ 不支持 gRPC（仅支持 HTTP 和 WebSocket）
- ✅ 使用 Web Crypto API 进行加密操作
- ✅ 支持 ESM 和 UMD 格式
- ✅ 支持 Tree Shaking

### Node.js 环境

**支持的版本**：
- Node.js 20+
- Node.js 22+（推荐）

**限制**：
- ✅ 支持 HTTP 和 WebSocket
- ✅ 使用 crypto 模块进行加密操作
- ✅ 支持 CJS 和 ESM 格式

---

## 📦 Bundler 配置

### Webpack

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
    ],
  },
};
```

### Vite

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
    },
  },
});
```

### Rollup

```javascript
// rollup.config.js
export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.cjs.js', format: 'cjs' },
    { file: 'dist/index.esm.js', format: 'es' },
  ],
};
```

---

## 🔧 TypeScript 类型系统

### 类型定义

SDK 提供完整的 TypeScript 类型定义：

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

// 类型安全
const client: Client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

// 类型推断
const wallet = Wallet.fromPrivateKey('0x...');
// wallet 类型自动推断为 Wallet
```

### 类型检查

```bash
# 运行类型检查
npx tsc --noEmit
```

---

## 🌳 Tree Shaking

SDK 支持 Tree Shaking，可以按需导入：

```typescript
// 只导入需要的模块
import { Client } from '@weisyn/client-sdk-js/client';
import { TokenService } from '@weisyn/client-sdk-js/services/token';

// 而不是
import * as SDK from '@weisyn/client-sdk-js';
```

---

## ⚠️ 常见限制

### 1. 浏览器环境限制

- **gRPC 不支持**：浏览器环境不支持 gRPC，只能使用 HTTP 和 WebSocket
- **CORS 问题**：需要配置 CORS 才能访问节点 API
- **Web Crypto API**：使用 Web Crypto API 进行加密操作

### 2. Node.js 环境限制

- **crypto 模块**：使用 Node.js 的 crypto 模块
- **WebSocket 支持**：需要安装 `ws` 包

### 3. TypeScript 限制

- **类型定义**：需要 TypeScript 5.0+
- **严格模式**：建议启用严格模式

---

## 🔗 相关文档

- [开发者指南](./DEVELOPER_GUIDE.md) - 开发基础
- [API 参考](./API_REFERENCE.md) - API 详细说明

---

**最后更新**: 2025-01-23  
**维护者**: WES Core Team

