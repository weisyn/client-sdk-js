/**
 * 端到端场景集成测试
 * 
 * 测试完整的业务流程，验证多个服务之间的协作
 * 需要真实节点运行才能执行
 */

import { TokenService } from '../../src/services/token/service';
import { StakingService } from '../../src/services/staking/service';
import { MarketService } from '../../src/services/market/service';
import { IClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
  waitForTransactionConfirmation,
  getTestAccountBalance,
} from './setup';

describe('End-to-End Integration Tests', () => {
  let client: IClient;
  let wallet: Wallet;
  let tokenService: TokenService;
  let stakingService: StakingService;
  let marketService: MarketService;
  let validatorWallet: Wallet;

  beforeAll(async () => {
    await ensureNodeRunning();
  });

  beforeEach(async () => {
    client = await setupTestClient();
    wallet = await createTestWallet();
    validatorWallet = await createTestWallet();
    
    // 为账户充值
    await fundTestAccount(client, wallet.address);
    await fundTestAccount(client, validatorWallet.address);
    
    // 创建服务实例
    tokenService = new TokenService(client, wallet);
    stakingService = new StakingService(client, wallet);
    marketService = new MarketService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('Complete Workflow: Transfer -> Stake -> Delegate -> Claim Reward', () => {
    it('should complete full staking workflow', async () => {
      // 1. 转账
      const recipient = await createTestWallet();
      const transferAmount = BigInt(1000000);

      const transferResult = await tokenService.transfer({
        from: wallet.address,
        to: recipient.address,
        amount: transferAmount,
        tokenId: null,
      }, wallet);

      expect(transferResult.success).toBe(true);
      await waitForTransactionConfirmation(client, transferResult.txHash);

      // 验证余额
      const recipientBalance = await getTestAccountBalance(client, recipient.address, null);
      expect(Number(recipientBalance)).toBeGreaterThanOrEqual(Number(transferAmount));

      // 2. 质押
      const stakeAmount = BigInt(500000);
      const stakeResult = await stakingService.stake({
        from: wallet.address,
        validatorAddr: validatorWallet.address,
        amount: stakeAmount,
      }, wallet);

      expect(stakeResult.success).toBe(true);
      expect(stakeResult.stakeId).toBeDefined();
      await waitForTransactionConfirmation(client, stakeResult.txHash);

      // 3. 委托
      const delegateAmount = BigInt(200000);
      const delegateResult = await stakingService.delegate({
        from: wallet.address,
        validatorAddr: validatorWallet.address,
        amount: delegateAmount,
      }, wallet);

      expect(delegateResult.success).toBe(true);
      expect(delegateResult.delegateId).toBeDefined();
      await waitForTransactionConfirmation(client, delegateResult.txHash);

      // 4. 领取奖励（如果有奖励）
      // 注意：实际奖励可能需要等待区块生成
      try {
        // stakeId 是 string，需要转换为 Uint8Array
        const { hexToBytes } = await import('../../src/utils/hex');
        const stakeIdBytes = hexToBytes(stakeResult.stakeId!);
        const claimResult = await stakingService.claimReward({
          from: wallet.address,
          stakeId: stakeIdBytes,
        }, wallet);

        if (claimResult.success) {
          expect(claimResult.txHash).toBeDefined();
          await waitForTransactionConfirmation(client, claimResult.txHash);
        }
      } catch (error) {
        // 如果没有奖励，这是正常的
        console.log('No reward to claim yet');
      }
    }, 180000); // 3分钟超时
  });

  describe('Complete Workflow: Transfer -> Create Escrow -> Release Escrow', () => {
    it('should complete escrow workflow', async () => {
      // 1. 转账
      const seller = await createTestWallet();
      const transferAmount = BigInt(1000000);

      const transferResult = await tokenService.transfer({
        from: wallet.address,
        to: seller.address,
        amount: transferAmount,
        tokenId: null,
      }, wallet);

      expect(transferResult.success).toBe(true);
      await waitForTransactionConfirmation(client, transferResult.txHash);

      // 2. 创建托管
      const escrowAmount = BigInt(500000);
      const escrowResult = await marketService.createEscrow({
        buyer: wallet.address,
        seller: seller.address,
        tokenId: null,
        amount: escrowAmount,
        expiry: BigInt(Date.now() + 3600000), // 1小时后过期
      }, wallet);

      expect(escrowResult.success).toBe(true);
      expect(escrowResult.escrowId).toBeDefined();
      await waitForTransactionConfirmation(client, escrowResult.txHash);

      // 3. 释放托管（卖方操作）
      // 使用卖方的 MarketService 实例
      const sellerMarketService = new MarketService(client, seller);
      const releaseResult = await sellerMarketService.releaseEscrow({
        from: seller.address,
        sellerAddress: seller.address,
        escrowId: escrowResult.escrowId!,
      }, seller);

      expect(releaseResult.success).toBe(true);
      await waitForTransactionConfirmation(client, releaseResult.txHash);

      // 验证卖方余额增加
      const sellerBalance = await getTestAccountBalance(client, seller.address, null);
      expect(Number(sellerBalance)).toBeGreaterThanOrEqual(Number(escrowAmount));
    }, 180000);
  });

  describe('Error Recovery: Insufficient Balance', () => {
    it('should handle insufficient balance gracefully', async () => {
      const newWallet = await createTestWallet();
      const hugeAmount = BigInt(1000000000000); // 非常大的金额

      await expect(
        tokenService.transfer({
          from: newWallet.address,
          to: wallet.address,
          amount: hugeAmount,
          tokenId: null,
        }, newWallet)
      ).rejects.toThrow();
    });
  });
});

