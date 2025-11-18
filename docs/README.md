# 文档中心

> 📚 WES Client SDK 的完整文档

## 📖 用户文档

### 快速开始
- [快速开始指南](./getting-started.md) - 安装和基本使用

### API 文档
- [客户端 API](./api/client.md) - Client 接口说明
- [服务 API](./api/services.md) - 业务服务接口
- [钱包 API](./api/wallet.md) - Wallet 接口说明

### 业务指南
- [Token 服务指南](./guides/token.md) - 代币操作
- [Staking 服务指南](./guides/staking.md) - 质押操作
- [Market 服务指南](./guides/market.md) - 市场操作
- [Governance 服务指南](./guides/governance.md) - 治理操作
- [Resource 服务指南](./guides/resource.md) - 资源操作

### 示例代码
- [示例代码](./examples/README.md) - 完整示例
  - [简单转账](./examples/simple-transfer.md)
  - [批量操作](./examples/batch-operations.md)
  - [质押流程](./examples/staking-flow.md)
  - [事件订阅](./examples/event-subscription.md)

### 参考文档
- [工具函数参考](./reference/batch.md) - 批量操作工具
- [文件工具参考](./reference/file.md) - 文件操作工具
- [重试工具参考](./reference/retry.md) - 重试机制

### 其他文档
- [架构概览](./architecture.md) - SDK 架构说明
- [TypeScript 支持](./typescript.md) - TypeScript 使用指南
- [浏览器兼容性](./browser.md) - 浏览器环境说明
- [测试指南](./testing.md) - 测试相关说明
- [故障排查](./troubleshooting.md) - 常见问题解决

## 🔧 开发文档

> ⚠️ **注意**：以下文档位于 `_dev/` 目录，仅供开发使用，不会发布到 npm。

### 发布相关
- [发布指南](../_dev/publishing/publishing.md) - 详细的发布流程
- [快速发布指南](../_dev/publishing/publishing-quick-start.md) - 快速参考
- [发布检查清单](../_dev/publishing/checklist.md) - 详细检查清单
- [版本历史](../_dev/publishing/version-history.md) - 版本变更记录

### 开发环境
- [Node.js 升级指南](../_dev/development/setup/node-upgrade-guide.md) - Node.js 版本管理
- [升级到 Node.js 22](../_dev/development/setup/upgrade-node-to-22.md) - 快速升级指南

### 故障排查
- [npm 修复指南](../_dev/development/troubleshooting/fix-npm.md) - npm 问题解决

## 📋 文档说明

### 用户文档 vs 开发文档

- **用户文档**（`docs/` 目录）：
  - 面向 SDK 使用者
  - 包含 API 文档、使用指南、示例代码
  - 会发布到 npm（如果配置允许）

- **开发文档**（`_dev/` 目录）：
  - 面向项目开发者
  - 包含发布流程、版本管理、开发环境设置
  - **不会发布到 npm**（已在 `.npmignore` 中排除）
  - **会提交到 Git**（团队协作需要）

### 文档位置

```
项目根目录/
├── docs/              # 用户文档（可能发布）
│   ├── getting-started.md
│   ├── guides/
│   ├── api/
│   └── ...
└── _dev/              # 开发文档（不发布）
    ├── publishing/    # 发布相关
    ├── development/   # 开发相关
    └── ...
```

## 🔗 相关链接

- [GitHub 仓库](https://github.com/weisyn/client-sdk-js)
- [npm 包](https://www.npmjs.com/package/@weisyn/client-sdk-js)
- [问题反馈](https://github.com/weisyn/client-sdk-js/issues)
