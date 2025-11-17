# 简单转账示例

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

这是最基本的转账示例，展示如何使用 SDK 进行原生币转账。

---

## 💻 完整代码

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

async function simpleTransfer() {
  // 1. 初始化客户端
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
    timeout: 30000,
  });

  // 2. 创建或导入钱包
  // 方式 1：创建新钱包
  const sender = await Wallet.create();
  
  // 方式 2：从私钥导入（实际使用时）
  // const sender = await Wallet.fromPrivateKey('0x...');

  // 3. 创建接收方钱包（示例）
  const recipient = await Wallet.create();

  // 4. 创建 Token 服务
  const tokenService = new TokenService(client, sender);

  // 5. 查询发送方余额（可选）
  const balanceBefore = await tokenService.getBalance(sender.address, null);
  console.log(`发送方余额: ${balanceBefore}`);

  // 6. 执行转账
  const transferAmount = BigInt(1000000); // 1 WES（假设 6 位小数）
  
  const result = await tokenService.transfer({
    from: sender.address,
    to: recipient.address,
    amount: transferAmount,
    tokenId: null, // null 表示原生币
  }, sender);

  console.log(`转账成功！`);
  console.log(`交易哈希: ${result.txHash}`);
  console.log(`转账金额: ${transferAmount}`);

  // 7. 查询接收方余额（可选）
  const balanceAfter = await tokenService.getBalance(recipient.address, null);
  console.log(`接收方余额: ${balanceAfter}`);
}

// 运行示例
simpleTransfer().catch(console.error);
```

---

## 🔍 代码说明

### 1. 客户端初始化

```typescript
const client = new Client({
  endpoint: 'http://localhost:8545', // WES 节点地址
  protocol: 'http',                    // 使用 HTTP 协议
  timeout: 30000,                      // 30 秒超时
});
```

### 2. 钱包创建

```typescript
// 创建新钱包（生成随机私钥）
const wallet = await Wallet.create();

// 从私钥导入（实际使用场景）
const wallet = await Wallet.fromPrivateKey('0x1234...');
```

### 3. Token 服务

```typescript
// 创建 Token 服务实例
const tokenService = new TokenService(client, sender);

// 转账参数
const transferParams = {
  from: sender.address,      // 发送方地址（20 字节）
  to: recipient.address,      // 接收方地址（20 字节）
  amount: BigInt(1000000),    // 转账金额（bigint）
  tokenId: null,             // null 表示原生币
};
```

### 4. 错误处理

```typescript
try {
  const result = await tokenService.transfer({
    from: sender.address,
    to: recipient.address,
    amount: BigInt(1000000),
    tokenId: null,
  }, sender);
  
  console.log(`转账成功: ${result.txHash}`);
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.error('余额不足');
  } else {
    console.error('转账失败:', error.message);
  }
}
```

---

## 🎯 运行示例

### Node.js 环境

```bash
# 1. 安装依赖
npm install @weisyn/client-sdk-js

# 2. 创建示例文件
# simple-transfer.ts

# 3. 运行
npx ts-node simple-transfer.ts
```

### 浏览器环境

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/@weisyn/client-sdk-js/dist/index.umd.js"></script>
</head>
<body>
  <script>
    const { Client, TokenService, Wallet } = WESClientSDK;
    
    async function transfer() {
      const client = new Client({
        endpoint: 'http://localhost:8545',
        protocol: 'http',
      });
      
      const sender = await Wallet.create();
      const recipient = await Wallet.create();
      const tokenService = new TokenService(client, sender);
      
      const result = await tokenService.transfer({
        from: sender.address,
        to: recipient.address,
        amount: BigInt(1000000),
        tokenId: null,
      }, sender);
      
      console.log('转账成功:', result.txHash);
    }
    
    transfer().catch(console.error);
  </script>
</body>
</html>
```

---

## ⚠️ 注意事项

1. **余额检查**：转账前确保发送方有足够的余额（包括交易手续费）
2. **地址格式**：地址必须是 20 字节的 `Uint8Array`
3. **金额类型**：使用 `BigInt` 避免精度问题
4. **交易确认**：转账提交后需要等待交易确认

---

## 🔗 相关文档

- **[Token 指南](../guides/token.md)** - Token 服务详细指南
- **[API 参考](../api/services.md#-token-service)** - Token Service API
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

