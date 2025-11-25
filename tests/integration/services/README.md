# 业务服务集成测试

**版本**: 1.0  


---

## 📋 概述

本目录包含所有业务服务的端到端集成测试，验证每个服务的完整生命周期流程。

---

## 🎯 测试原则

每个服务的测试都遵循"**完整生命周期**"原则：

1. **准备阶段**：设置测试环境，准备账户和余额
2. **执行阶段**：执行业务操作（转账、质押、投票等）
3. **验证阶段**：查询链上状态，验证操作结果
4. **清理阶段**：可选，恢复测试环境

---

## 📊 服务覆盖

### TokenService

**测试文件**: `token-flow.test.ts`

**完整流程**：
1. 查询 `USER_A` 初始余额
2. `USER_A → USER_B` 单笔转账
3. `USER_A → USER_B` 批量转账（多次）
4. 查询最终余额，验证变动
5. 查询交易记录和事件

**验证点**：
- ✅ 余额变化正确
- ✅ 交易状态为 confirmed
- ✅ 事件正确触发
- ✅ 批量操作性能合理

---

### StakingService

**测试文件**: `staking-flow.test.ts`

**完整流程**：
1. `USER_A` 质押一定数量
2. 触发/等待几块后领取奖励
3. `USER_A` 解质押
4. 校验质押余额/可用余额/事件

**验证点**：
- ✅ 质押后余额正确
- ✅ 奖励计算正确
- ✅ 解质押后余额恢复
- ✅ 质押/解质押事件正确

---

### MarketService

**测试文件**: `market-flow.test.ts`

**完整流程**：
1. 添加流动性（A/B Token 对）
2. 执行 Swap（A → B）
3. 移除流动性
4. 校验余额变化

**验证点**：
- ✅ 流动性添加成功
- ✅ Swap 价格计算正确
- ✅ 流动性移除后余额恢复
- ✅ AMM 事件正确

---

### GovernanceService

**测试文件**: `governance-flow.test.ts`

**完整流程**：
1. `USER_A` 发起参数更新提案
2. `USER_A` 和 `USER_B` 投票
3. 等待投票期结束
4. 检查提案状态和执行结果

**验证点**：
- ✅ 提案创建成功
- ✅ 投票记录正确
- ✅ 提案状态转换正确
- ✅ 提案执行结果正确

---

### ResourceService

**测试文件**: `resource-flow.test.ts`

**完整流程**：
1. 部署一个小型静态资源或模型
2. 查询 metadata
3. 访问内容 hash
4. 校验资源状态

**验证点**：
- ✅ 资源部署成功
- ✅ Metadata 查询正确
- ✅ 内容 hash 匹配
- ✅ 资源状态正确

---

### PermissionService

**测试文件**: `permission-flow.test.ts`

**完整流程**：
1. `USER_A` 创建资源
2. 添加 `USER_B` 为协作者
3. 设置时间锁
4. 验证权限（`USER_B` 可以访问，时间锁生效）

**验证点**：
- ✅ 资源创建成功
- ✅ 协作者添加成功
- ✅ 时间锁设置正确
- ✅ 权限验证正确

---

## 🚀 运行测试

```bash
# 运行所有服务测试
npm run test:integration -- tests/integration/services

# 运行特定服务测试
npm run test:integration -- tests/integration/services -t "token"

# 运行特定服务的特定测试
npm run test:integration -- tests/integration/services -t "token.*transfer"
```

---

## 📝 测试示例

### TokenService 完整流程示例

```typescript
describe('TokenService Flow', () => {
  it('should complete full transfer flow', async () => {
    const client = setupTestClient();
    
    // 准备账户
    const walletA = createTestWallet();
    const walletB = createTestWallet();
    await fundTestAccount(client, walletA.address, 1000000);
    
    // 查询初始余额
    const balanceA = await getTestAccountBalance(client, walletA.address);
    expect(balanceA).toBe(1000000n);
    
    // 单笔转账
    const tokenService = new TokenService(client);
    const result = await tokenService.transfer({
      from: walletA.address,
      to: walletB.address,
      amount: 100000n,
    }, walletA);
    
    // 等待确认
    await triggerMining(client, walletA.address);
    await waitForTransactionConfirmation(client, result.txHash);
    
    // 验证余额
    const balanceAAfter = await getTestAccountBalance(client, walletA.address);
    const balanceB = await getTestAccountBalance(client, walletB.address);
    expect(balanceAAfter).toBe(900000n); // 扣除手续费
    expect(balanceB).toBe(100000n);
  });
});
```

---

## 🔗 相关文档

- [集成测试设计文档](../DESIGN.md)
- [集成测试快速开始指南](../README.md)
- [业务服务 API 文档](../../../docs/api/services.md)

---



