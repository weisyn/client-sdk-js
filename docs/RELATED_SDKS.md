# 相关 SDK 文档

**版本**：1.0  
**状态**：stable  
**最后更新**：2025-01-23  
**所有者**：WES SDK 团队  
**适用范围**：WES Client SDK 生态关联文档

---

## 🎯 文档目标

本文档说明 WES Client SDK 生态中不同语言版本的 SDK 之间的关系和关联。

---

## 📦 WES SDK 生态

### SDK 分类

WES SDK 生态分为两大类：

1. **Contract SDK（链上 SDK）** - 用于开发智能合约（WASM）
2. **Client SDK（链下 SDK）** - 用于开发 DApp、钱包、浏览器等应用

### Contract SDK

| SDK | 语言 | 仓库 | 状态 |
|-----|------|------|------|
| **contract-sdk-go** | Go (TinyGo) | [github.com/weisyn/contract-sdk-go](https://github.com/weisyn/contract-sdk-go) | ✅ 稳定 |
| **contract-sdk-rust** | Rust | 待创建 | ⏳ 计划中 |
| **contract-sdk-as** | AssemblyScript | 待创建 | ⏳ 计划中 |

### Client SDK

| SDK | 语言 | 仓库 | 状态 |
|-----|------|------|------|
| **client-sdk-go** | Go | [github.com/weisyn/client-sdk-go](https://github.com/weisyn/client-sdk-go) | ✅ 稳定 |
| **client-sdk-js** | JavaScript/TypeScript | [github.com/weisyn/client-sdk-js](https://github.com/weisyn/client-sdk-js) | ✅ 开发中 |

---

## 🔗 Client SDK 关联

### 功能对比

| 功能模块 | Go SDK | JS/TS SDK | 说明 |
|---------|--------|-----------|------|
| **Client** | ✅ | ✅ | 核心客户端，功能对等 |
| **Wallet** | ✅ | ✅ | 钱包功能，功能对等 |
| **Token** | ✅ | ✅ | Token 服务，功能对等 |
| **Staking** | ⚠️ 部分 | ⚠️ 骨架 | 待节点 API 支持 |
| **Market** | ⚠️ 部分 | ⚠️ 骨架 | 待节点 API 支持 |
| **Governance** | ⚠️ 部分 | ⚠️ 骨架 | 待节点 API 支持 |
| **Resource** | ⚠️ 部分 | ⚠️ 部分 | 待节点 API 支持 |

### API 一致性

两个 SDK 提供**相同的业务语义接口**，确保：

- ✅ **API 设计一致** - 方法名、参数、返回值保持一致
- ✅ **业务语义一致** - 相同的业务逻辑和流程
- ✅ **类型定义一致** - 相同的数据结构定义

### 使用场景

**Go SDK 适用于**：
- 后端服务开发
- 命令行工具
- 服务器端应用
- 高性能场景

**JS/TS SDK 适用于**：
- 浏览器 DApp 开发
- 区块浏览器开发
- Node.js 后端服务
- 前端应用集成

---

## 📚 文档关联

### 交叉引用

两个 SDK 的文档相互引用：

- **Go SDK README** → 链接到 JS/TS SDK
- **JS/TS SDK README** → 链接到 Go SDK
- **API 文档** → 相互参考

### 统一文档

- **架构设计** - 两个 SDK 遵循相同的架构设计
- **业务语义** - 两个 SDK 实现相同的业务语义
- **最佳实践** - 共享最佳实践文档

---

## 🔄 版本同步

### 版本策略

- **主版本号** - 与 WES 节点 API 版本对齐
- **次版本号** - 功能更新
- **修订版本号** - Bug 修复

### 同步原则

- ✅ 两个 SDK 的**主版本号保持一致**
- ✅ 新功能在两个 SDK 中**同步实现**
- ✅ API 变更在**两个 SDK 中同步**

---

## 💡 选择建议

### 选择 Go SDK 如果：

- ✅ 开发后端服务
- ✅ 需要高性能
- ✅ 团队熟悉 Go
- ✅ 需要与 Go 生态集成

### 选择 JS/TS SDK 如果：

- ✅ 开发浏览器应用
- ✅ 开发 DApp 前端
- ✅ 开发区块浏览器
- ✅ 团队熟悉 JavaScript/TypeScript

### 同时使用两个 SDK：

- ✅ 前端使用 JS/TS SDK，后端使用 Go SDK
- ✅ 不同服务使用不同 SDK
- ✅ 根据团队技能选择

---

## 🔗 相关链接

- [Go Client SDK](https://github.com/weisyn/client-sdk-go) - Go 版本 SDK
- [JS/TS Client SDK](https://github.com/weisyn/client-sdk-js) - JavaScript/TypeScript 版本 SDK
- [Contract SDK](https://github.com/weisyn/contract-sdk-go) - 智能合约开发 SDK
- [WES 主项目](https://github.com/weisyn/weisyn-core) - WES 区块链核心

---

**最后更新**: 2025-01-23

