# 故障排查指南

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

本文档提供常见错误的排查方法和解决方案。

---

## 🔗 关联文档

- **WES 故障排查**：[WES 节点故障排查](https://github.com/weisyn/weisyn/blob/main/docs/troubleshooting/README.md)（待确认）
- **快速开始**：[快速开始指南](./getting-started.md)

---

## 🔌 连接问题

### 连接失败

**错误信息**：
```
NetworkError: Failed to connect to node
```

**可能原因**：
1. 节点未启动
2. 端点地址错误
3. 网络不可达

**解决方案**：
```typescript
// 1. 检查节点是否运行
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
});

try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  console.error('节点连接失败，请检查：');
  console.error('1. 节点是否已启动？');
  console.error('2. 端点地址是否正确？');
  console.error('3. 防火墙是否阻止连接？');
}
```

---

### 连接超时

**错误信息**：
```
NetworkError: Request timeout
```

**可能原因**：
1. 节点响应慢
2. 网络延迟高
3. 超时设置过短

**解决方案**：
```typescript
// 增加超时时间
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  timeout: 60000, // 60 秒
});
```

---

### CORS 错误（浏览器）

**错误信息**：
```
CORS policy: No 'Access-Control-Allow-Origin' header
```

**可能原因**：
1. 节点不支持 CORS
2. 浏览器安全策略

**解决方案**：
```typescript
// 方案 1：使用代理
const client = new Client({
  endpoint: '/api/wes', // 通过后端代理
  protocol: 'http',
});

// 方案 2：配置节点支持 CORS（节点端配置）
```

---

## 💰 交易问题

### 余额不足

**错误信息**：
```
TransactionError: Insufficient balance
```

**可能原因**：
1. 账户余额不足
2. 未考虑交易手续费

**解决方案**：
```typescript
import { TokenService } from '@weisyn/client-sdk-js';

const tokenService = new TokenService(client, wallet);

// 查询余额
const balance = await tokenService.getBalance(wallet.address, null);

// 检查余额是否足够（包括手续费）
const requiredAmount = transferAmount + estimatedFee;
if (balance < requiredAmount) {
  console.error('余额不足');
}
```

---

### 交易失败

**错误信息**：
```
TransactionError: Transaction failed
```

**可能原因**：
1. 交易参数错误
2. 锁定条件未满足
3. 合约执行失败

**解决方案**：
```typescript
try {
  await tokenService.transfer({...}, wallet);
} catch (error) {
  if (error instanceof TransactionError) {
    console.error('交易失败:', error.message);
    console.error('交易哈希:', error.txHash);
    
    // 查询交易状态
    const txStatus = await client.call('wes_getTransactionByHash', [error.txHash]);
    console.error('交易状态:', txStatus);
  }
}
```

---

### 交易未确认

**错误信息**：
```
Transaction pending
```

**可能原因**：
1. 交易已提交但未确认
2. 网络拥堵

**解决方案**：
```typescript
// 等待交易确认
async function waitForConfirmation(client: Client, txHash: string) {
  for (let i = 0; i < 30; i++) {
    const tx = await client.call('wes_getTransactionByHash', [txHash]);
    if (tx.status === 'confirmed') {
      return tx;
    }
    await sleep(1000); // 等待 1 秒
  }
  throw new Error('交易确认超时');
}
```

---

## 🔐 密钥和签名问题

### 私钥格式错误

**错误信息**：
```
WalletError: Invalid private key format
```

**可能原因**：
1. 私钥长度不正确
2. 私钥格式错误

**解决方案**：
```typescript
// 确保私钥是 32 字节（64 个十六进制字符）
const privateKey = '0x' + '1'.repeat(64); // 32 字节
const wallet = await Wallet.fromPrivateKey(privateKey);
```

---

### Keystore 解密失败

**错误信息**：
```
WalletError: Failed to decrypt keystore
```

**可能原因**：
1. 密码错误
2. Keystore 文件损坏

**解决方案**：
```typescript
try {
  const wallet = await Keystore.decrypt(keystoreData, password);
} catch (error) {
  if (error.message.includes('decrypt')) {
    console.error('密码错误或 Keystore 文件损坏');
    // 提示用户重新输入密码
  }
}
```

---

### 签名验证失败

**错误信息**：
```
TransactionError: Invalid signature
```

**可能原因**：
1. 签名算法错误
2. 签名数据错误

**解决方案**：
```typescript
// 确保使用正确的钱包签名
const signedTx = await wallet.signTransaction(unsignedTx);

// 验证签名格式
if (signedTx.length !== 64) {
  throw new Error('签名长度不正确');
}
```

---

## 🌐 JSON-RPC 错误

### 方法不存在

**错误信息**：
```
JSONRPCError: Method not found
```

**可能原因**：
1. 方法名错误
2. 节点版本不支持

**解决方案**：
```typescript
// 检查方法是否存在
try {
  await client.call('wes_blockNumber', []);
} catch (error) {
  if (error.code === -32601) {
    console.error('方法不存在，请检查：');
    console.error('1. 方法名是否正确？');
    console.error('2. 节点版本是否支持？');
  }
}
```

---

### 参数错误

**错误信息**：
```
JSONRPCError: Invalid params
```

**可能原因**：
1. 参数类型错误
2. 参数数量错误

**解决方案**：
```typescript
// 检查参数类型和数量
const address = wallet.address; // Uint8Array (20 bytes)
const addressBase58 = await addressBytesToBase58Async(address);

// 确保参数格式正确
await client.call('wes_getUTXO', [addressBase58]); // 字符串
```

---

## 🌍 浏览器环境问题

### Web Crypto API 不可用

**错误信息**：
```
BrowserCompatibilityError: Web Crypto API not available
```

**可能原因**：
1. 浏览器不支持 Web Crypto API
2. 非 HTTPS 环境（某些浏览器要求）

**解决方案**：
```typescript
// 检查 Web Crypto API 支持
if (!window.crypto || !window.crypto.subtle) {
  console.error('浏览器不支持 Web Crypto API');
  // 提示用户使用支持的浏览器
}
```

---

### 文件读取失败

**错误信息**：
```
BrowserCompatibilityError: File reading failed
```

**可能原因**：
1. File API 不支持
2. 文件格式错误

**解决方案**：
```typescript
// 使用 FileReader API
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

if (!file) {
  console.error('未选择文件');
  return;
}

const fileContent = new Uint8Array(await file.arrayBuffer());
```

---

## 🔄 重试问题

### 重试次数过多

**错误信息**：
```
NetworkError: Max retries exceeded
```

**可能原因**：
1. 网络持续不稳定
2. 节点持续不可用

**解决方案**：
```typescript
// 调整重试配置
const client = new Client({
  endpoint: 'http://localhost:8545',
  protocol: 'http',
  retry: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 10000,
  },
});
```

---

## 📊 性能问题

### 批量操作超时

**错误信息**：
```
Timeout: Batch operation exceeded time limit
```

**可能原因**：
1. 批量大小过大
2. 并发数过高

**解决方案**：
```typescript
// 减小批量大小和并发数
const results = await batchQuery(
  items,
  queryFn,
  {
    batchSize: 50,      // 减小批量大小
    concurrency: 3,     // 减小并发数
  }
);
```

---

### 大文件处理内存溢出

**错误信息**：
```
Error: Out of memory
```

**可能原因**：
1. 文件太大
2. 未使用分块处理

**解决方案**：
```typescript
// 使用分块处理
import { processFileInChunks } from '@weisyn/client-sdk-js';

await processFileInChunks(
  largeFile,
  async (chunk) => {
    // 处理每个分块
  },
  {
    chunkSize: 5 * 1024 * 1024, // 5MB 每块
  }
);
```

---

## 🔗 相关文档

- **[快速开始](./getting-started.md)** - 安装和配置
- **[浏览器兼容性](./browser.md)** - 浏览器环境使用
- **[测试指南](./testing.md)** - 测试相关

---

**最后更新**: 2025-11-17

