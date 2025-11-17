# Wallet API 参考

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

`Wallet` 提供密钥管理、交易签名、地址派生等功能。它支持从私钥导入、Keystore 加密存储等场景。

---

## 🔗 关联文档

- **架构说明**：[SDK 架构设计](../architecture.md)
- **安全指南**：[最佳实践](../reference/security.md)（待创建）

---

## 📦 导入

```typescript
import { Wallet, Keystore } from '@weisyn/client-sdk-js';
```

---

## 🏗️ Wallet 接口

### IWallet

```typescript
interface IWallet {
  /** 地址（20 字节） */
  address: Uint8Array;
  
  /** 公钥 */
  publicKey: Uint8Array;
  
  /** 签名交易 */
  signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
  
  /** 签名消息 */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  
  /** 签名哈希值 */
  signHash(hash: Uint8Array): Uint8Array;
}
```

---

## 🚀 使用示例

### 创建新钱包

```typescript
// 创建新钱包（生成随机私钥）
const wallet = await Wallet.create();

console.log('地址:', wallet.address);
console.log('公钥:', wallet.publicKey);
```

### 从私钥导入

```typescript
// 从十六进制私钥导入
const wallet = await Wallet.fromPrivateKey('0x1234...');

// 或使用不带 0x 前缀的格式
const wallet = await Wallet.fromPrivateKey('1234...');
```

### 签名交易

```typescript
// 1. 获取未签名交易（通过 Client）
const unsignedTx = await client.call('wes_buildTransaction', [draft]);

// 2. Wallet 签名
const signedTx = await wallet.signTransaction(unsignedTxBytes);

// 3. 提交交易
const result = await client.sendRawTransaction(signedTxHex);
```

### 签名消息

```typescript
const message = new TextEncoder().encode('Hello, WES!');
const signature = await wallet.signMessage(message);

// 签名可用于身份验证等场景
```

---

## 🔐 Keystore 加密存储

### 导出到 Keystore

```typescript
import { Keystore } from '@weisyn/client-sdk-js';

// 导出钱包到 Keystore（加密存储）
const keystoreData = await Keystore.encrypt(wallet, 'password123');

// 保存到文件（Node.js）
const fs = require('fs').promises;
await fs.writeFile('keystore.json', JSON.stringify(keystoreData, null, 2));
```

### 从 Keystore 导入

```typescript
// 从文件加载（Node.js）
const keystoreData = JSON.parse(await fs.readFile('keystore.json', 'utf-8'));

// 解密并导入钱包
const wallet = await Keystore.decrypt(keystoreData, 'password123');
```

### 浏览器环境

```typescript
// 浏览器环境：使用 FileReader 读取文件
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const text = await file.text();
const keystoreData = JSON.parse(text);

const wallet = await Keystore.decrypt(keystoreData, password);
```

---

## 🔑 地址操作

### 获取地址

```typescript
// 获取 20 字节地址
const addressBytes = wallet.address; // Uint8Array (20 bytes)

// 转换为 Base58 格式
import { addressBytesToBase58Async } from '@weisyn/client-sdk-js';
const addressBase58 = await addressBytesToBase58Async(addressBytes);

// 转换为十六进制格式
import { addressToHex } from '@weisyn/client-sdk-js';
const addressHex = addressToHex(addressBytes); // '0x...'
```

### 地址验证

```typescript
import { addressBase58ToBytesAsync } from '@weisyn/client-sdk-js';

try {
  const addressBytes = await addressBase58ToBytesAsync(addressBase58);
  console.log('地址有效:', addressBytes);
} catch (error) {
  console.error('地址无效:', error.message);
}
```

---

## 🔒 安全考虑

### 私钥安全

```typescript
// ✅ 推荐：使用 Keystore 加密存储
const keystoreData = await Keystore.encrypt(wallet, strongPassword);
await saveToSecureStorage(keystoreData);

// ❌ 不推荐：明文存储私钥
const privateKeyHex = wallet.exportPrivateKey(); // 仅用于调试
// 不要将私钥保存到文件或发送到服务器
```

### 密码管理

```typescript
// ✅ 推荐：使用强密码
const password = generateStrongPassword(); // 至少 12 位，包含大小写字母、数字、特殊字符

// ✅ 推荐：使用密码管理器
// 让用户使用密码管理器生成和存储密码
```

### 浏览器环境

```typescript
// ✅ 推荐：使用 Web Crypto API（自动）
// SDK 在浏览器环境自动使用 Web Crypto API，私钥不离开内存

// ⚠️ 注意：避免在控制台打印私钥
// console.log(wallet.exportPrivateKey()); // 危险！
```

---

## 📚 方法参考

### Wallet.create()

创建新钱包（生成随机私钥）。

```typescript
static async create(): Promise<Wallet>
```

**返回**：`Promise<Wallet>` - 新创建的钱包

**示例**：
```typescript
const wallet = await Wallet.create();
```

---

### Wallet.fromPrivateKey()

从私钥创建钱包。

```typescript
static async fromPrivateKey(privateKeyHex: string): Promise<Wallet>
```

**参数**：
- `privateKeyHex`: 私钥（十六进制字符串，可带或不带 `0x` 前缀）

**返回**：`Promise<Wallet>` - 钱包实例

**示例**：
```typescript
const wallet = await Wallet.fromPrivateKey('0x1234...');
```

---

### wallet.signTransaction()

签名交易。

```typescript
signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>
```

**参数**：
- `unsignedTx`: 未签名交易（`Uint8Array`）

**返回**：`Promise<Uint8Array>` - 签名（64 字节）

**流程**：
1. 计算交易哈希（SHA-256）
2. 使用 ECDSA 签名哈希
3. 返回紧凑格式签名（r || s）

---

### wallet.signMessage()

签名消息。

```typescript
signMessage(message: Uint8Array): Promise<Uint8Array>
```

**参数**：
- `message`: 消息（`Uint8Array`）

**返回**：`Promise<Uint8Array>` - 签名（64 字节）

**用途**：身份验证、消息认证等

---

### wallet.signHash()

签名哈希值（同步方法）。

```typescript
signHash(hash: Uint8Array): Uint8Array
```

**参数**：
- `hash`: 哈希值（32 字节）

**返回**：`Uint8Array` - 签名（64 字节）

**注意**：这是同步方法，适用于已计算好哈希的场景

---

### wallet.exportPrivateKey()

导出私钥（谨慎使用）。

```typescript
exportPrivateKey(): string
```

**返回**：`string` - 私钥（十六进制字符串）

**⚠️ 安全警告**：
- 私钥应该保密，不要在不安全的环境中导出
- 建议使用 Keystore 进行加密存储
- 仅在调试或迁移场景使用

---

## 🔗 相关文档

- **[Client API](./client.md)** - 客户端接口
- **[Services API](./services.md)** - 业务服务
- **[浏览器兼容性](../browser.md)** - 浏览器环境使用指南
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

