# 示例代码

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

本文档提供 WES Client SDK (JS/TS) 的实用示例代码，涵盖常见使用场景。

---

## 🚀 快速示例

### 基础示例

- **[简单转账](./simple-transfer.md)** - 最基本的转账示例
- **[钱包创建](./wallet-creation.md)** - 创建和管理钱包
- **[余额查询](./balance-query.md)** - 查询账户余额

### 业务场景示例

- **[质押流程](./staking-flow.md)** - 完整的质押、奖励领取、解质押流程
- **[AMM 交换](./amm-swap.md)** - AMM 代币交换示例
- **[托管交易](./escrow-transaction.md)** - 托管交易流程
- **[治理投票](./governance-vote.md)** - 提案创建和投票

### 高级示例

- **[批量操作](./batch-operations.md)** - 批量转账和查询
- **[大文件部署](./large-file-deployment.md)** - 部署大文件资源
- **[事件订阅](./event-subscription.md)** - WebSocket 事件订阅

---

## 📚 示例说明

所有示例代码都可以直接运行，但需要：

1. **安装依赖**：
```bash
npm install @weisyn/client-sdk-js
```

2. **配置节点端点**：
```typescript
const client = new Client({
  endpoint: 'http://localhost:8545', // 修改为你的节点地址
  protocol: 'http',
});
```

3. **准备测试账户**：
- 示例中使用的是测试账户
- 实际使用时需要替换为真实的钱包地址和私钥

---

## 🔗 相关文档

- **[快速开始](../getting-started.md)** - 安装和配置
- **[API 参考](../api/)** - 完整 API 文档
- **[使用指南](../guides/)** - 业务场景指南

---

**最后更新**: 2025-11-17

