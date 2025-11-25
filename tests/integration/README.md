# 集成测试

**版本**：1.0  
**最后更新**：2025-11-23

---

## 📋 概述

集成测试需要连接到真实的 WES 节点才能执行。这些测试验证 SDK 与节点的端到端交互。

> 📖 **设计文档**：查看 [集成测试设计文档](./DESIGN.md) 了解完整的测试体系设计。

---

## 🚀 运行集成测试

### 前置条件

1. **启动 WES 节点（SDK 集成测试环境）**

   **推荐方式：使用 SDK 集成测试专用环境**
   ```bash
   cd /Users/qinglong/go/src/chaincodes/WES/weisyn.git
   ./scripts/sdk-integration/start.sh
   ```

   **环境配置**：
   - **HTTP JSON-RPC**: `http://127.0.0.1:8545`
   - **WebSocket**: `ws://127.0.0.1:8081`
   - **预置账户**：Miner、User A、User B（通过环境变量导出）

2. **设置环境变量**（可选，启动脚本会自动导出）

   ```bash
   export WES_ENDPOINT_HTTP=http://127.0.0.1:8545
   export WES_ENDPOINT_WS=ws://127.0.0.1:8081
   export WES_TEST_PRIVKEY_MINER=0x...
   export WES_TEST_PRIVKEY_USER_A=0x...
   export WES_TEST_PRIVKEY_USER_B=0x...
   ```

### 运行测试

```bash
# 进入 SDK 项目目录
cd /Users/qinglong/go/src/chaincodes/WES/sdk/client-sdk-js.git

# 运行所有集成测试
npm run test:integration

# 运行特定测试
npm run test:integration -- tests/integration/wesclient
npm run test:integration -- tests/integration/services
npm run test:integration -- tests/integration/error-model

# 跳过集成测试（只运行单元测试）
npm run test:unit
```

---

## 📁 目录结构

```
tests/integration/
├── DESIGN.md              # 集成测试设计文档
├── README.md              # 本文档（快速开始指南）
├── setup.ts               # 测试环境设置和客户端管理
├── env.ts                 # 读取 env，封装 Endpoint/账户信息
├── helpers.ts             # 通用 helper：发交易、等待上链、断言余额...
│
├── wesclient/             # WESClient Typed API 测试
│   ├── README.md          # WESClient 测试说明
│   ├── node-info.test.ts  # getNodeInfo 测试
│   ├── utxo.test.ts       # listUTXOs 测试（地址模型）
│   ├── resource.test.ts   # getResource/getResources/batchGetResources 测试
│   ├── tx.test.ts         # getTransaction/getTransactionHistory/submitTransaction 测试
│   └── events.test.ts     # getEvents/subscribeEvents 测试
│
├── services/              # 业务 Service 端到端 Flow 测试
│   ├── README.md          # 业务服务测试说明
│   ├── token-flow.test.ts      # TokenService 完整生命周期测试
│   ├── staking-flow.test.ts    # StakingService 完整生命周期测试
│   ├── market-flow.test.ts     # MarketService 完整生命周期测试
│   ├── governance-flow.test.ts # GovernanceService 完整生命周期测试
│   ├── resource-flow.test.ts   # ResourceService 完整生命周期测试
│   └── permission-flow.test.ts # PermissionService 完整生命周期测试
│
├── error-model/           # 错误模型 & 传输层测试
│   ├── README.md          # 错误模型测试说明
│   ├── http-error.test.ts      # HTTP 错误模型测试
│   └── ws-error.test.ts        # WebSocket 错误模型测试
│
└── fixtures/              # 测试数据和期望结果
    ├── README.md          # Fixtures 说明
    ├── accounts.json      # 预置账户配置
    ├── contracts/         # 预置合约
    └── expectations/     # 期望状态/错误码（与 Go SDK 共享）
```

---

## 🔧 测试工具函数

### 客户端管理

- `setupTestClient(config?)` - 创建并验证测试客户端连接
- `teardownTestClient(client)` - 清理测试客户端连接

### 账户管理

- `createTestWallet()` - 创建新的测试钱包
- `fundTestAccount(client, address, amount?)` - 为测试账户充值（通过挖矿）
- `getTestAccountBalance(client, address, tokenId?)` - 查询账户余额

### 交易管理

- `waitForTransactionConfirmation(client, txHash, timeout?)` - 等待交易确认
- `triggerMining(client, minerAddr)` - 触发挖矿

### 环境检查

- `ensureNodeRunning(config?)` - 确保节点正在运行（否则抛出错误）

---

## ⚠️ 注意事项

1. **节点必须运行**：集成测试需要真实的节点连接
2. **测试时间较长**：集成测试可能需要等待交易确认，建议设置较长的超时时间
3. **测试隔离**：每个测试用例应该使用独立的钱包，避免相互影响
4. **环境变量**：可以通过环境变量指定节点端点和账户信息

---

## 📚 完整文档

### 设计文档
- **[集成测试设计文档](./DESIGN.md)** - 完整的测试体系设计、覆盖矩阵和执行策略

### 子目录文档
- **[WESClient 测试说明](./wesclient/README.md)** - WESClient Typed API 测试说明
- **[业务服务测试说明](./services/README.md)** - 各服务测试的详细说明和运行指南
- **[错误模型测试说明](./error-model/README.md)** - 错误模型和传输层测试说明
- **[测试 Fixtures 说明](./fixtures/README.md)** - 测试数据和期望结果说明

### 相关文档
- **[单元测试](../README.md)** - 单元测试说明
- **[测试设置](./setup.ts)** - 测试环境设置
- **[SDK 能力对比文档](../../docs/capability-comparison.md)** - SDK 能力矩阵

## 🔗 相关资源

- **[WES 主项目](https://github.com/weisyn/go-weisyn)** - WES 区块链核心实现
- **[SDK 集成测试环境配置](../../../../weisyn.git/scripts/sdk-integration/README.md)** - SDK 集成测试专用环境配置文档

---



