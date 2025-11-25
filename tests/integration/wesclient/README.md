# WESClient Typed API 集成测试

**版本**: 1.0  


---

## 📋 概述

本目录包含 `WESClient` 类型化 API 的集成测试，验证所有 11 个核心方法在真实 WES 节点上的行为。

---

## 🎯 测试目标

验证 `WESClient` 接口的所有方法能够：
1. 正确调用 WES 节点的 JSON-RPC API
2. 正确解析和返回类型化的响应
3. 正确处理错误情况
4. 与链上状态保持一致

---

## 📊 覆盖范围

### UTXO 操作（3/3）

| 方法 | 测试文件 | 状态 |
|------|---------|------|
| `listUTXOs` | `utxo.test.ts` | ✅ 已实现 |

**测试场景**：
- 查询存在的 UTXO，验证金额和锁定条件
- 查询不存在的 UTXO，验证错误处理
- 批量查询多个 UTXO，验证性能和正确性

### 资源操作（3/3）

| 方法 | 测试文件 | 状态 |
|------|---------|------|
| `getResource` | `resource.test.ts` | 🚧 待实现 |
| `getResources` | `resource.test.ts` | 🚧 待实现 |
| `batchGetResources` | `resource.test.ts` | 🚧 待实现 |

**测试场景**：
- 查询预置的合约/模型/静态资源
- 使用 filters 查询资源列表
- 批量查询多个资源，验证性能

### 交易操作（3/3）

| 方法 | 测试文件 | 状态 |
|------|---------|------|
| `getTransaction` | `tx.test.ts` | 🚧 待实现 |
| `getTransactionHistory` | `tx.test.ts` | 🚧 待实现 |
| `submitTransaction` | `tx.test.ts` | 🚧 待实现 |

**测试场景**：
- 提交交易并查询交易状态
- 查询交易历史记录，验证过滤和排序
- 验证交易确认后的状态变化

### 事件操作（2/2）

| 方法 | 测试文件 | 状态 |
|------|---------|------|
| `getEvents` | `event.test.ts` | 🚧 待实现 |
| `subscribeEvents` | `event.test.ts` | 🚧 待实现 |

**测试场景**：
- Query 模式查询事件列表
- Subscribe 模式通过 WebSocket 接收事件
- 验证事件过滤条件

### 节点信息（1/1）

| 方法 | 测试文件 | 状态 |
|------|---------|------|
| `getNodeInfo` | `node-info.test.ts` | 🚧 待实现 |

**测试场景**：
- 获取节点版本、链 ID、当前高度
- 验证返回数据的格式和有效性

---

## 🚀 运行测试

```bash
# 运行所有 WESClient 测试
npm run test:integration -- tests/integration/wesclient

# 运行特定测试
npm run test:integration -- tests/integration/wesclient -t "listUTXOs"
```

---

## 📝 测试示例

### listUTXOs 测试示例

```typescript
describe('listUTXOs', () => {
  it('should list UTXOs by address', async () => {
    const client = setupTestClient();
    
    // 预置一个 UTXO
    const wallet = createTestWallet();
    await fundTestAccount(client, wallet.address, 1000000);
    
    // 查询 UTXO 列表（地址模型，与节点 API 对齐）
    const utxos = await client.listUTXOs(wallet.address);
    expect(Array.isArray(utxos)).toBe(true);
    if (utxos.length > 0) {
      expect(utxos[0].outPoint).toBeDefined();
    }
  });
});
```

---

## 🔗 相关文档

- [集成测试设计文档](../DESIGN.md)
- [集成测试快速开始指南](../README.md)
- [WESClient API 文档](../../../docs/api/client.md)

---



