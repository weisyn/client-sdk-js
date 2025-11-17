# Resource 服务指南

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

Resource Service 提供资源部署和查询功能，支持智能合约、AI 模型和静态资源的部署。

---

## 🔗 关联文档

- **API 参考**：[Services API - Resource](../api/services.md#-resource-service)
- **WES 协议**：[WES 资源模型](https://github.com/weisyn/weisyn/blob/main/docs/system/components/resource/README.md)（待确认）

---

## 🚀 快速开始

### 创建服务

```typescript
import { Client, ResourceService, Wallet } from '@weisyn/client-sdk-js';

const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

const wallet = await Wallet.create();
const resourceService = new ResourceService(client, wallet);
```

---

## 📦 部署智能合约

### 基本部署

```typescript
// Node.js 环境：从文件读取 WASM 字节码
const fs = require('fs').promises;
const wasmBytes = await fs.readFile('contract.wasm');

const result = await resourceService.deployContract({
  from: wallet.address,
  wasmBytes: wasmBytes,
  name: 'MyContract',
  description: 'A simple smart contract',
}, wallet);

console.log(`合约部署成功！交易哈希: ${result.txHash}`);
console.log(`合约 ID: ${result.contractId}`);
```

### 浏览器环境

```typescript
// 浏览器环境：使用 FileReader 读取文件
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const wasmBytes = new Uint8Array(await file.arrayBuffer());

const result = await resourceService.deployContract({
  from: wallet.address,
  wasmBytes: wasmBytes,
  name: 'MyContract',
  description: 'A simple smart contract',
}, wallet);
```

### 实现原理

SDK 内部调用 `wes_deployResource`，将 WASM 字节码部署到链上：

```typescript
// SDK 内部实现（简化）
await client.call('wes_deployResource', [
  {
    type: 'contract',
    content: wasmBytes,
    name: name,
    description: description,
  },
]);
```

---

## 🤖 部署 AI 模型

### 部署 ONNX 模型

```typescript
// Node.js 环境：从文件读取 ONNX 模型
const fs = require('fs').promises;
const modelBytes = await fs.readFile('model.onnx');

const result = await resourceService.deployAIModel({
  from: wallet.address,
  modelBytes: modelBytes,
  name: 'ImageClassifier',
  framework: 'ONNX',
}, wallet);

console.log(`AI 模型部署成功！交易哈希: ${result.txHash}`);
console.log(`模型 ID: ${result.modelId}`);
```

### 支持的框架

```typescript
// 当前支持 ONNX
const result = await resourceService.deployAIModel({
  from: wallet.address,
  modelBytes: modelBytes,
  name: 'MyModel',
  framework: 'ONNX', // 或 'TensorFlow', 'PyTorch'（如果支持）
}, wallet);
```

---

## 📄 部署静态资源

### 部署图片

```typescript
// Node.js 环境
const fs = require('fs').promises;
const imageBytes = await fs.readFile('image.png');

const result = await resourceService.deployStaticResource({
  from: wallet.address,
  fileContent: imageBytes,
  mimeType: 'image/png',
}, wallet);

console.log(`静态资源部署成功！交易哈希: ${result.txHash}`);
console.log(`资源 ID: ${result.resourceId}`);
```

### 部署 JSON 数据

```typescript
const jsonData = JSON.stringify({ key: 'value' });
const jsonBytes = new TextEncoder().encode(jsonData);

const result = await resourceService.deployStaticResource({
  from: wallet.address,
  fileContent: jsonBytes,
  mimeType: 'application/json',
}, wallet);
```

### 浏览器环境

```typescript
// 浏览器环境：使用 File API
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const fileContent = new Uint8Array(await file.arrayBuffer());

const result = await resourceService.deployStaticResource({
  from: wallet.address,
  fileContent: fileContent,
  mimeType: file.type,
}, wallet);
```

---

## 🔍 查询资源

### 查询资源信息

```typescript
// 注意：查询资源不需要 Wallet
const resourceInfo = await resourceService.getResource(resourceId);

console.log(`资源类型: ${resourceInfo.type}`);
console.log(`资源大小: ${resourceInfo.size} 字节`);
console.log(`MIME 类型: ${resourceInfo.mimeType}`);
```

### 资源信息结构

```typescript
interface ResourceInfo {
  resourceId: string;      // 资源 ID（32 字节哈希）
  type: 'contract' | 'model' | 'static';
  size: number;            // 资源大小（字节）
  mimeType?: string;      // MIME 类型（静态资源）
  name?: string;          // 资源名称
  description?: string;  // 资源描述
}
```

---

## 🎯 典型场景

### 场景 1：部署并调用合约

```typescript
async function deployAndCallContract(
  deployer: Wallet,
  wasmBytes: Uint8Array
) {
  const resourceService = new ResourceService(client, deployer);
  
  // 1. 部署合约
  const deployResult = await resourceService.deployContract({
    from: deployer.address,
    wasmBytes: wasmBytes,
    name: 'MyContract',
  }, deployer);
  
  console.log(`合约 ID: ${deployResult.contractId}`);
  
  // 2. 调用合约（通过 TokenService 或其他服务）
  // 例如：调用合约的 mint 方法
  const tokenService = new TokenService(client, deployer);
  await tokenService.mint({
    to: recipient.address,
    amount: BigInt(1000),
    tokenId: tokenId,
    contractAddr: hexToBytes(deployResult.contractId!),
  }, deployer);
}
```

### 场景 2：部署大文件资源

```typescript
import { processFileInChunks } from '@weisyn/client-sdk-js';

async function deployLargeFile(
  filePath: string,
  mimeType: string,
  wallet: Wallet
) {
  const resourceService = new ResourceService(client, wallet);
  
  // Node.js 环境：读取文件
  const fs = require('fs').promises;
  const fileContent = await fs.readFile(filePath);
  
  // 如果文件很大，可以显示进度
  if (fileContent.length > 10 * 1024 * 1024) {
    console.log(`文件大小: ${fileContent.length} 字节`);
    // 可以使用 processFileInChunks 进行分块处理
  }
  
  // 部署资源
  const result = await resourceService.deployStaticResource({
    from: wallet.address,
    fileContent: fileContent,
    mimeType: mimeType,
  }, wallet);
  
  return result.resourceId;
}
```

### 场景 3：批量部署资源

```typescript
async function batchDeployResources(
  resources: Array<{ path: string; mimeType: string }>,
  wallet: Wallet
) {
  const resourceService = new ResourceService(client, wallet);
  const fs = require('fs').promises;
  
  const results = await Promise.all(
    resources.map(async (resource) => {
      const fileContent = await fs.readFile(resource.path);
      return await resourceService.deployStaticResource({
        from: wallet.address,
        fileContent: fileContent,
        mimeType: resource.mimeType,
      }, wallet);
    })
  );
  
  return results.map(r => r.resourceId);
}
```

---

## ⚠️ 常见错误

### 文件太大

```typescript
try {
  const largeFile = new Uint8Array(200 * 1024 * 1024); // 200MB
  await resourceService.deployStaticResource({
    from: wallet.address,
    fileContent: largeFile,
    mimeType: 'application/octet-stream',
  }, wallet);
} catch (error) {
  if (error.message.includes('file too large')) {
    console.error('文件太大，请使用分块上传');
  }
}
```

### 无效的 WASM 格式

```typescript
try {
  const invalidWasm = new Uint8Array([0x00, 0x01, 0x02]); // 无效的 WASM
  await resourceService.deployContract({
    from: wallet.address,
    wasmBytes: invalidWasm,
  }, wallet);
} catch (error) {
  if (error.message.includes('invalid wasm')) {
    console.error('无效的 WASM 格式');
  }
}
```

### 资源不存在

```typescript
try {
  const invalidResourceId = hexToBytes('0x' + '0'.repeat(64));
  await resourceService.getResource(invalidResourceId);
} catch (error) {
  if (error.message.includes('resource not found')) {
    console.error('资源不存在');
  }
}
```

---

## 🔗 相关文档

- **[API 参考](../api/services.md#-resource-service)** - 完整 API 文档
- **[大文件处理](../reference/file.md)** - 大文件处理指南
- **[浏览器兼容性](../browser.md)** - 浏览器环境使用
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

