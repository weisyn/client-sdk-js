/**
 * Staking Service 集成测试
 * 
 * 需要真实节点运行才能执行
 */

import { StakingService } from '../../src/services/staking/service';
import { Client } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
  waitForTransactionConfirmation,
} from './setup';

describe('Staking Service Integration Tests', () => {
  let client: Client;
  let wallet: Wallet;
  let stakingService: StakingService;
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
    
    stakingService = new StakingService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('Stake', () => {
    it('should stake tokens successfully', async () => {
      const amount = BigInt(1000000);

      const result = await stakingService.stake({
        from: wallet.address,
        validatorAddr: validatorWallet.address,
        amount,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.stakeId).toBeDefined();
    }, 60000);
  });

  describe('Delegate', () => {
    it('should delegate tokens successfully', async () => {
      const amount = BigInt(500000);

      const result = await stakingService.delegate({
        from: wallet.address,
        validatorAddr: validatorWallet.address,
        amount,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.delegateId).toBeDefined();
    }, 60000);
  });
});

