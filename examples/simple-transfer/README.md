# 简单转账示例

这是一个使用 WES Client SDK 进行简单转账的示例。

## 运行示例

```bash
# 安装依赖
npm install

# 运行示例
npm run example:transfer
```

## 代码示例

```typescript
import { Client, TokenService, Wallet } from '@weisyn/client-sdk-js';

async function main() {
  // 1. 初始化客户端
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
  });

  // 2. 创建钱包
  const wallet = Wallet.fromPrivateKey('0x...');

  // 3. 创建 Token 服务
  const tokenService = new TokenService(client, wallet);

  // 4. 执行转账
  const result = await tokenService.transfer({
    from: wallet.address,
    to: hexToAddress('0x...'),
    amount: 1000000,
    tokenId: null,
  });

  console.log(`转账成功！交易哈希: ${result.txHash}`);
}

main().catch(console.error);
```

