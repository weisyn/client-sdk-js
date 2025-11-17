# 归档文档说明

---

## 📌 版本信息

- **版本**：0.1.0-alpha
- **状态**：archived
- **最后更新**：2025-11-17
- **最后审核**：2025-11-17
- **所有者**：SDK 团队
- **适用范围**：JavaScript/TypeScript 客户端 SDK（已归档）

---

## 📖 概述

本目录包含 JS SDK 的归档文档，这些文档已按新的文档结构重新组织或整合。

---

## 🔄 文档迁移状态

| 归档文档 | 新位置 | 状态 |
|---------|--------|------|
| `BROWSER_COMPATIBILITY.md` | `../browser.md` | ✅ 已迁移 |
| `BEST_PRACTICES.md` | `../guides/` 和 `../reference/` | ✅ 已整合 |
| `PERFORMANCE.md` | `../reference/retry.md`, `../reference/batch.md`, `../reference/file.md` | ✅ 已整合 |
| `CAPABILITY_COMPARISON.md` | 保留在归档中（历史记录） | 📦 归档保留 |
| `RELATED_SDKS.md` | 保留在归档中（历史记录） | 📦 归档保留 |
| `API.md` | `../api/` | ✅ 已迁移 |

---

## 📝 归档文档说明

### BROWSER_COMPATIBILITY.md

**状态**：已迁移到 `../browser.md`

**说明**：浏览器兼容性指南，包括环境检测、加密实现差异、文件处理等。

---

### BEST_PRACTICES.md

**状态**：已整合到新文档

**说明**：最佳实践指南，内容已整合到：
- `../guides/` - 业务指南中的最佳实践
- `../reference/` - 参考文档中的使用建议
- `../troubleshooting.md` - 故障排查中的常见问题

---

### PERFORMANCE.md

**状态**：已整合到参考文档

**说明**：性能优化指南，内容已整合到：
- `../reference/retry.md` - 重试机制
- `../reference/batch.md` - 批量操作
- `../reference/file.md` - 大文件处理

---

### CAPABILITY_COMPARISON.md

**状态**：保留在归档中

**说明**：Go/JS SDK 能力对比文档，作为历史记录保留。

---

### RELATED_SDKS.md

**状态**：保留在归档中

**说明**：相关 SDK 说明文档，作为历史记录保留。

---

### API.md

**状态**：已迁移到 `../api/`

**说明**：API 参考文档，已拆分为：
- `../api/client.md` - Client API
- `../api/wallet.md` - Wallet API
- `../api/services.md` - Services API

---

## 🔗 相关文档

- **[新文档中心](../README.md)** - 完整的文档导航
- **[Go SDK 文档](../../client-sdk-go.git/docs/README.md)** - 参考 Go SDK 文档结构

---

## 📌 注意事项

- ⚠️ 本目录中的文档为历史版本，仅供参考
- ✅ 请使用新文档结构中的文档（`../` 目录）
- 📦 归档文档保留作为历史记录，不进行更新

---

