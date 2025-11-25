# 错误模型集成测试

**版本**: 1.0  


---

## 📋 概述

本目录包含错误模型和传输层的集成测试，验证 SDK 在不同传输协议下的错误处理行为是否符合 WES Error Spec。

---

## 🎯 测试目标

验证 SDK 的错误处理：
1. **错误结构正确**：`WesError` 包含 `code/layer/userMessage/traceId`
2. **错误分类正确**：HTTP/WebSocket 错误正确映射到 `WesError`
3. **错误传播正确**：底层错误正确转换为用户友好的错误消息
4. **跨协议一致性**：同一错误在不同协议下表现一致

---

## 📊 覆盖范围

### HTTP 错误

**测试文件**: `http-error.test.ts`

**测试场景**：
- 调用不存在的方法 → 验证 `WesError` 结构
- 参数非法 → 验证错误码和用户消息
- 网络错误 → 验证错误传播
- 超时错误 → 验证超时处理

**验证点**：
- ✅ `WesError.code` 正确
- ✅ `WesError.layer` 正确（SDK_HTTP_ERROR 或 COMMON_VALIDATION_ERROR，取决于节点实现）
- ✅ `WesError.userMessage` 用户友好
- ✅ `WesError.traceId` 存在（如果节点返回）

---

### WebSocket 错误

**测试文件**: `ws-error.test.ts`

**测试场景**：
- 在 WS 上调用非法方法 → 验证错误模型
- WS 连接断开 → 验证错误处理
- WS 订阅错误 → 验证错误传播

**验证点**：
- ✅ `WesError.code` 正确
- ✅ `WesError.layer` 正确（SDK_WEBSOCKET_ERROR）
- ✅ `WesError.userMessage` 用户友好
- ✅ WebSocket 错误正确转换为 `WesError`

---

## 🚀 运行测试

```bash
# 运行所有错误模型测试
npm run test:integration -- tests/integration/error-model

# 运行特定测试
npm run test:integration -- tests/integration/error-model -t "http"
```

---

## 📝 测试示例

### HTTP 错误测试示例

```typescript
describe('HTTP Error', () => {
  it('should handle invalid method', async () => {
    const client = setupTestClient();
    
    // 调用不存在的方法
    await expect(
      client.call('nonexistent_method', [])
    ).rejects.toThrow();
    
    try {
      await client.call('nonexistent_method', []);
    } catch (err) {
      expect(err).toBeInstanceOf(WesError);
      const wesErr = err as WesError;
      expect(wesErr.code).toBe(ErrorCode.MethodNotFound);
      // 节点可能返回 SDK_HTTP_ERROR 或 COMMON_VALIDATION_ERROR
      expect([ErrorLayer.SDK_HTTP_ERROR, ErrorLayer.COMMON_VALIDATION_ERROR]).toContain(wesErr.layer);
      expect(wesErr.userMessage).toBeTruthy();
    }
  });
});
```

---

## 🔗 相关文档

- [集成测试设计文档](../DESIGN.md)
- [集成测试快速开始指南](../README.md)
- [WES Error Spec 实现文档](../../../docs/WES_ERROR_SPEC_IMPLEMENTATION.md)

---



