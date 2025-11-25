# JS SDK 集成测试设计文档

**版本**: 1.0  
**状态**: 📋 设计阶段  


---

## 📋 概述

本文档定义 `client-sdk-js` 的集成测试体系设计，目标是构建一套"接近生产"的端到端集成测试体系，**完整覆盖 Client SDK 对外承诺的能力矩阵**。

---

## 🎯 总体目标与原则

### 目标

对接本地 `weisyn.git` 启动的 WES 节点，构建一套"接近生产"的端到端集成测试体系，**完整覆盖 Client SDK 对外承诺的能力矩阵**，而不是只做冒烟。

### 原则

- **能力完备**：所有在能力对比表中标记为 ✅ 的能力，都要至少有一条"真实上链 + 真实读取"的集成用例。

- **行为对齐**：Go / JS 在同一场景下，**观察到的链上效果 / 错误模型一致**。

- **环境可复现**：通过脚本 + 固定配置，一键起 devnet + 一键跑 Go/JS 集成测试。

- **与单元测试分层**：单测只测纯逻辑；**集成测试专门验证"SDK ↔ WES 节点 ↔ 链状态"这一整条链路**。

---

## 🏗️ 目录结构与分层

```
tests/
  integration/
    DESIGN.md              # 本文档
    README.md              # 集成测试快速开始指南
    setup.ts               # 测试环境设置和客户端管理
    env.ts                 # 读取 env，封装 Endpoint/账户信息
    helpers.ts             # 通用 helper：发交易、等待上链、断言余额...
    
    wesclient/             # WESClient Typed API 测试
      README.md            # WESClient 测试说明
      node-info.test.ts    # getNodeInfo 测试
      utxo.test.ts         # listUTXOs 测试（地址模型）
      resource.test.ts     # getResource/getResources/batchGetResources 测试
      tx.test.ts           # getTransaction/getTransactionHistory/submitTransaction 测试
      events.test.ts       # getEvents/subscribeEvents 测试
    
    services/              # 业务 Service 端到端 Flow 测试
      README.md            # 业务服务测试说明
      token-flow.test.ts   # TokenService 完整生命周期测试
      staking-flow.test.ts # StakingService 完整生命周期测试
      market-flow.test.ts  # MarketService 完整生命周期测试
      governance-flow.test.ts # GovernanceService 完整生命周期测试
      resource-flow.test.ts   # ResourceService 完整生命周期测试
      permission-flow.test.ts # PermissionService 完整生命周期测试
    
    error-model/           # 错误模型 & 传输层测试
      README.md            # 错误模型测试说明
      http-error.test.ts   # HTTP 错误模型测试
      ws-error.test.ts     # WebSocket 错误模型测试
    
    fixtures/              # 测试数据和期望结果
      README.md            # Fixtures 说明
      accounts.json        # 预置账户配置
      contracts/           # 预置合约
      expectations/        # 期望状态/错误码（与 Go SDK 共享）
```

---

## 📊 覆盖矩阵（能力 → 测试场景）

### 1. WESClient Typed API（11/11 方法）

#### getNodeInfo
- **测试场景**：调用 `getNodeInfo`
- **断言**：
  - 返回版本/链 ID/高度非空
  - 版本格式正确
  - 链 ID 与配置一致

#### listUTXOs
- **测试场景**：使用 `USER_A` 预置一个 UTXO，再通过地址查询
- **断言**：
  - 通过地址查询返回该地址的所有 UTXO 列表
  - 返回的 UTXO 包含正确的金额、锁定条件
  - 空地址（无 UTXO）返回空数组
  - 无效地址返回正确错误

#### getResource / getResources / batchGetResources
- **测试场景**：针对预置的合约/模型/静态资源
- **断言**：
  - 能按 ID 查到
  - 能按 filters 查列表
  - 批量查询性能正确

#### getTransaction / getTransactionHistory
- **测试场景**：通过 Token/其他服务发起一笔交易
- **断言**：
  - `getTransaction` 能查到正确状态、区块高度
  - `getTransactionHistory` 能按地址筛出刚才那笔
  - 历史记录按时间排序

#### getEvents / subscribeEvents
- **测试场景**：对某个合约（比如 Token Transfer）
- **断言**：
  - Query 模式能查回事件列表
  - Subscribe 模式通过 WS 收到事件（需要一个简单的消费循环 + 超时）
  - 事件过滤条件正确

---

### 2. 业务 Service（端到端 Flow）

#### TokenService
- **场景**：`USER_A → USER_B` 转账 + 批量转账
- **流程**：
  1. 查询 `USER_A` 余额
  2. 单笔转账
  3. 批量转账（A→B 多次）
  4. 再次查询余额，校验变动
  5. 校验交易记录/事件

#### StakingService
- **场景**：`USER_A` 质押 → 领取奖励 → 解质押
- **流程**：
  1. 质押一定数量
  2. 触发/等待几块后领取奖励
  3. 解质押
  4. 校验质押余额/可用余额/事件

#### MarketService
- **场景**：简单 AMM Swap 或 添加/移除流动性
- **流程**：
  1. 添加流动性
  2. 执行 Swap
  3. 移除流动性
  4. 校验余额变化

#### GovernanceService
- **场景**：发起一个参数更新提案 → 投票 → 检查结果
- **流程**：
  1. 发起提案
  2. 投票（多个账户）
  3. 等待投票期结束
  4. 检查提案状态和执行结果

#### ResourceService
- **场景**：部署一个小型静态资源或模型 → 查询 metadata → 访问内容 hash
- **流程**：
  1. 部署资源
  2. 查询 metadata
  3. 访问内容 hash
  4. 校验资源状态

#### PermissionService
- **场景**：资源所有权转移 + 协作者管理 + 时间/高度锁一条 happy path
- **流程**：
  1. 创建资源
  2. 添加协作者
  3. 设置时间锁
  4. 验证权限

> **设计要求**：**每个服务至少有一个"完整生命周期测试"，从请求 → 上链 → 再读回链上状态。**

---

### 3. 错误模型 & 传输层

#### HTTP 错误
- **测试场景**：调用一个不存在的方法 / 参数非法
- **断言**：`WesError`（`code/layer/userMessage/traceId`）

#### WebSocket 错误
- **测试场景**：在 WS 上调用非法方法/错误参数
- **断言**：复用 `websocketClient`，断言错误模型

---

## 🔧 环境与基础设施

### 依赖 weisyn.git 的 SDK 集成测试环境

集成测试依赖 `weisyn.git` 提供的"SDK 集成测试专用环境"：

- **单节点 Devnet Profile**（`profiles/sdk-integration`）：
  - 固定端口：
    - HTTP: `http://127.0.0.1:8545`
    - WS: `ws://127.0.0.1:8081`
  - 预置账户（写进文档 & fixture）：
    - `WES_TEST_MINER`：出块 + 初始大余额
    - `WES_TEST_USER_A`：普通用户 A（有初始 WES）
    - `WES_TEST_USER_B`：普通用户 B
  - 预置合约 / 资源（可选，但推荐）：
    - 一个标准 Token 合约部署完成
    - 至少一个用于 Staking/Market/Governance 的基础合约或系统参数

### 环境变量

测试通过环境变量读取配置：

- `WES_ENDPOINT_HTTP`：HTTP 端点（默认：`http://127.0.0.1:8545`）
- `WES_ENDPOINT_WS`：WebSocket 端点（默认：`ws://127.0.0.1:8081`）
- `WES_TEST_PRIVKEY_MINER`：Miner 私钥
- `WES_TEST_PRIVKEY_USER_A`：User A 私钥
- `WES_TEST_PRIVKEY_USER_B`：User B 私钥

---

## 🚀 执行策略

### 本地开发者流程

1. **起 WES devnet**：
```bash
cd /Users/qinglong/go/src/chaincodes/WES/weisyn.git
./scripts/sdk-integration/start.sh
```

2. **JS SDK 集成测试**：
```bash
cd /Users/qinglong/go/src/chaincodes/WES/sdk/client-sdk-js.git
npm run test:integration
```

### CI 分层

- **快速 Job（每次 PR）**：
  - 只跑单元测试（JS）

- **Nightly / Pre-release Job**：
  - 在 CI 里起 `weisyn` devnet（docker 或本地二进制）
  - 跑 JS 集成测试 + 覆盖率
  - 可以加一份"对齐报告"，确认所有关键用例都通过

---

## 🔄 跨 SDK 一致性检查

### 共享 Fixtures

定义一组 JSON 描述的"期望状态"/"期望错误码"，两边测试都基于同一份 fixture：

- `fixtures/token/basic-transfer.json`：基础转账期望结果
- `fixtures/staking/basic-stake.json`：基础质押期望结果
- `fixtures/error-codes.json`：错误码映射表

在 Go/JS 测试中读取同一文件，保证断言条件完全一致。

---

## 📚 相关文档

- [集成测试快速开始指南](./README.md)
- [WESClient 测试说明](./wesclient/README.md)
- [业务服务测试说明](./services/README.md)
- [错误模型测试说明](./error-model/README.md)
- [测试 Fixtures 说明](./fixtures/README.md)
- [SDK 能力对比文档](../../docs/capability-comparison.md)

---

  
**维护者**: Client SDK Team

