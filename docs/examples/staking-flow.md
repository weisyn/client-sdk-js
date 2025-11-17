# 质押流程示例

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

完整的质押流程示例，包括质押、领取奖励、解质押。

---

## 💻 完整代码

```typescript
import { Client, StakingService, TokenService, Wallet } from '@weisyn/client-sdk-js';
import { sleep } from '@weisyn/client-sdk-js';

async function completeStakingFlow() {
  // 1. 初始化客户端
  const client = new Client({
    endpoint: 'http://localhost:8545',
    protocol: 'http',
  });

  // 2. 创建钱包
  const staker = await Wallet.create();
  const validator = await Wallet.create(); // 验证者钱包

  // 3. 创建服务
  const stakingService = new StakingService(client, staker);
  const tokenService = new TokenService(client, staker);

  // 4. 查询初始余额
  const initialBalance = await tokenService.getBalance(staker.address, null);
  console.log(`初始余额: ${initialBalance}`);

  // 5. 质押
  const stakeAmount = BigInt(1000000); // 1 WES
  const lockBlocks = 1000; // 锁定 1000 个区块

  console.log('开始质押...');
  const stakeResult = await stakingService.stake({
    from: staker.address,
    validatorAddr: validator.address,
    amount: stakeAmount,
    lockBlocks: lockBlocks,
  }, staker);

  console.log(`质押成功！`);
  console.log(`交易哈希: ${stakeResult.txHash}`);
  console.log(`质押 ID: ${stakeResult.stakeId}`);

  // 6. 等待一段时间以累积奖励（实际场景中需要等待区块生成）
  console.log('等待奖励累积...');
  await sleep(10000); // 等待 10 秒（示例）

  // 7. 领取奖励
  try {
    console.log('领取奖励...');
    const claimResult = await stakingService.claimReward({
      from: staker.address,
      stakeId: stakeResult.stakeId!,
    }, staker);

    console.log(`奖励领取成功！`);
    console.log(`交易哈希: ${claimResult.txHash}`);
    console.log(`奖励金额: ${claimResult.reward}`);
  } catch (error) {
    console.log('暂无奖励或奖励已领取');
  }

  // 8. 等待锁定期结束（实际场景中需要等待区块高度达到）
  // 这里简化处理，直接尝试解质押
  console.log('等待锁定期结束...');
  await sleep(5000); // 等待 5 秒（示例）

  // 9. 解质押
  try {
    console.log('开始解质押...');
    const unstakeResult = await stakingService.unstake({
      from: staker.address,
      stakeId: stakeResult.stakeId!,
    }, staker);

    console.log(`解质押成功！`);
    console.log(`交易哈希: ${unstakeResult.txHash}`);
    console.log(`解质押金额: ${unstakeResult.amount}`);
    console.log(`奖励金额: ${unstakeResult.reward}`);
  } catch (error) {
    if (error.message.includes('lock not expired')) {
      console.log('锁定期未结束，无法解质押');
    } else {
      console.error('解质押失败:', error.message);
    }
  }

  // 10. 查询最终余额
  const finalBalance = await tokenService.getBalance(staker.address, null);
  console.log(`最终余额: ${finalBalance}`);
}

// 运行示例
completeStakingFlow().catch(console.error);
```

---

## 🔍 代码说明

### 1. 质押

```typescript
const stakeResult = await stakingService.stake({
  from: staker.address,
  validatorAddr: validator.address,
  amount: BigInt(1000000),
  lockBlocks: 1000, // 可选：锁定 1000 个区块
}, staker);
```

**参数说明**：
- `from`: 质押者地址
- `validatorAddr`: 验证者地址
- `amount`: 质押金额
- `lockBlocks`: 锁定期（区块数，可选）

**返回**：
- `txHash`: 交易哈希
- `stakeId`: 质押 ID（用于后续操作）

### 2. 领取奖励

```typescript
const claimResult = await stakingService.claimReward({
  from: staker.address,
  stakeId: stakeId, // 使用质押时获得的 stakeId
}, staker);
```

**返回**：
- `txHash`: 交易哈希
- `reward`: 奖励金额

### 3. 解质押

```typescript
const unstakeResult = await stakingService.unstake({
  from: staker.address,
  stakeId: stakeId,
}, staker);
```

**返回**：
- `txHash`: 交易哈希
- `amount`: 解质押金额
- `reward`: 奖励金额

---

## 🎯 运行示例

```bash
# 1. 安装依赖
npm install @weisyn/client-sdk-js

# 2. 创建示例文件
# staking-flow.ts

# 3. 运行
npx ts-node staking-flow.ts
```

---

## ⚠️ 注意事项

1. **锁定期**：如果设置了 `lockBlocks`，需要等待锁定期结束才能解质押
2. **奖励累积**：奖励需要等待区块生成后才能领取
3. **余额检查**：确保质押账户有足够的余额
4. **交易确认**：每个操作都需要等待交易确认

---

## 🔗 相关文档

- **[Staking 指南](../guides/staking.md)** - Staking 服务详细指南
- **[API 参考](../api/services.md#-staking-service)** - Staking Service API
- **[故障排查](../troubleshooting.md)** - 常见问题

---

**最后更新**: 2025-11-17

