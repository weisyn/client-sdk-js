# 测试指南

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

本文档说明 SDK 的测试结构、如何运行测试，以及与 WES 节点测试的关系。

---

## 🔗 关联文档

- **WES 测试策略**：[WES 测试文档](https://github.com/weisyn/weisyn/blob/main/docs/testing/README.md)（待确认）
- **快速开始**：[快速开始指南](./getting-started.md)

---

## 🏗️ 测试结构

### 目录结构

```
tests/
├── unit/              # 单元测试
│   ├── client/       # Client 测试
│   ├── wallet/       # Wallet 测试
│   ├── services/     # Services 测试
│   └── utils/        # Utils 测试
├── integration/      # 集成测试
│   ├── setup.ts      # 集成测试工具函数
│   ├── token.integration.test.ts
│   ├── staking.integration.test.ts
│   ├── market.integration.test.ts
│   ├── governance.integration.test.ts
│   ├── resource.integration.test.ts
│   └── e2e.integration.test.ts
└── e2e/              # 端到端测试（可选）
    └── scenarios.test.ts
```

---

## 🧪 单元测试

### 运行单元测试

```bash
# 运行所有单元测试
npm test

# 运行特定模块的单元测试
npm test -- tests/unit/wallet

# 使用 watch 模式
npm test -- --watch
```

### 单元测试示例

```typescript
// tests/unit/wallet/wallet.test.ts
import { Wallet } from '../../../src/wallet/wallet';

describe('Wallet', () => {
  it('should create a new wallet', async () => {
    const wallet = await Wallet.create();
    expect(wallet.address).toHaveLength(20);
    expect(wallet.publicKey).toBeDefined();
  });

  it('should import wallet from private key', async () => {
    const privateKey = '0x1234...';
    const wallet = await Wallet.fromPrivateKey(privateKey);
    expect(wallet.address).toBeDefined();
  });
});
```

### 测试覆盖范围

- ✅ **Client**：连接、重试、错误处理
- ✅ **Wallet**：密钥生成、签名、Keystore
- ✅ **Services**：业务逻辑、参数验证
- ✅ **Utils**：地址转换、批量操作、文件处理

---

## 🔗 集成测试

### 运行集成测试

```bash
# 运行所有集成测试（需要本地节点运行）
npm run test:integration

# 运行特定服务的集成测试
npm run test:integration -- tests/integration/token.integration.test.ts
```

### 集成测试设置

```typescript
// tests/integration/setup.ts
import { Client, Wallet } from '../../src';

export async function setupTestClient(): Promise<Client> {
  return new Client({
    endpoint: process.env.WES_NODE_ENDPOINT || 'http://localhost:8545',
    protocol: 'http',
  });
}

export async function createTestWallet(): Promise<Wallet> {
  return await Wallet.create();
}

export async function fundTestAccount(
  client: Client,
  address: Uint8Array
): Promise<void> {
  // 为测试账户充值（需要测试节点支持）
  await client.call('wes_fundTestAccount', [address, BigInt(1000000000)]);
}
```

### 集成测试示例

```typescript
// tests/integration/token.integration.test.ts
import { setupTestClient, createTestWallet, fundTestAccount } from './setup';
import { TokenService } from '../../src/services/token/service';

describe('Token Service Integration', () => {
  let client: Client;
  let wallet: Wallet;
  let tokenService: TokenService;

  beforeAll(async () => {
    client = await setupTestClient();
    wallet = await createTestWallet();
    await fundTestAccount(client, wallet.address);
    tokenService = new TokenService(client, wallet);
  });

  it('should transfer tokens', async () => {
    const recipient = await createTestWallet();
    const result = await tokenService.transfer({
      from: wallet.address,
      to: recipient.address,
      amount: BigInt(1000000),
      tokenId: null,
    }, wallet);

    expect(result.success).toBe(true);
    expect(result.txHash).toBeDefined();
  });
});
```

### 集成测试覆盖范围

- ✅ **Token Service**：转账、批量转账、余额查询
- ✅ **Staking Service**：质押、解质押、委托、奖励领取
- ✅ **Market Service**：AMM 交换、流动性、托管
- ✅ **Governance Service**：提案、投票、参数更新
- ✅ **Resource Service**：合约部署、资源查询
- ✅ **端到端场景**：完整业务流程测试

---

## 🎯 端到端测试

### 运行端到端测试

```bash
# 运行端到端测试（需要本地节点运行）
npm run test:e2e
```

### 端到端测试示例

```typescript
// tests/integration/e2e.integration.test.ts
describe('End-to-End Scenarios', () => {
  it('should complete transfer -> stake -> claim reward -> unstake flow', async () => {
    // 1. 转账
    const transferResult = await tokenService.transfer({...}, wallet);
    
    // 2. 质押
    const stakeResult = await stakingService.stake({...}, wallet);
    
    // 3. 领取奖励
    const claimResult = await stakingService.claimReward({...}, wallet);
    
    // 4. 解质押
    const unstakeResult = await stakingService.unstake({...}, wallet);
    
    expect(unstakeResult.success).toBe(true);
  });
});
```

---

## 🔧 测试配置

### Jest 配置

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/integration/**/*.integration.test.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### 环境变量

```bash
# .env.test
WES_NODE_ENDPOINT=http://localhost:8545
WES_NODE_PROTOCOL=http
```

---

## 📊 测试覆盖

### 查看测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看 HTML 报告
open coverage/index.html
```

### 覆盖率目标

- **单元测试**：> 80%
- **集成测试**：覆盖主要业务流程
- **端到端测试**：覆盖关键用户场景

---

## 🚀 CI/CD 集成

### GitHub Actions 示例

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run test:integration
        env:
          WES_NODE_ENDPOINT: http://localhost:8545
```

---

## 🔗 与 WES 节点测试的关系

### SDK 测试 vs 节点测试

| 测试类型 | SDK 测试 | 节点测试 |
|---------|---------|---------|
| **范围** | SDK 代码逻辑 | 节点协议实现 |
| **依赖** | Mock 或本地节点 | 真实节点环境 |
| **目标** | SDK 功能正确性 | 协议一致性 |

### 测试分层

```
┌─────────────────────────────────────┐
│  WES 节点测试（协议层）              │
│  - 共识测试                          │
│  - EUTXO 测试                        │
│  - JSON-RPC 测试                     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  SDK 集成测试（接口层）              │
│  - 与真实节点交互                    │
│  - 端到端场景                        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  SDK 单元测试（代码层）              │
│  - 业务逻辑                          │
│  - 工具函数                          │
└─────────────────────────────────────┘
```

---

## 🔗 相关文档

- **[快速开始](./getting-started.md)** - 安装和配置
- **[故障排查](./troubleshooting.md)** - 常见问题
- **[贡献指南](../CONTRIBUTING.md)** - 如何贡献代码

---

**最后更新**: 2025-11-17

