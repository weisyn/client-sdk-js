/**
 * Market Service 集成测试
 * 
 * 需要真实节点运行才能执行
 */

import { MarketService } from '../../src/services/market/service';
import { IClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
} from './setup';

describe('Market Service Integration Tests', () => {
  let client: IClient;
  let wallet: Wallet;
  let marketService: MarketService;

  beforeAll(async () => {
    await ensureNodeRunning();
  });

  beforeEach(async () => {
    client = await setupTestClient();
    wallet = await createTestWallet();
    await fundTestAccount(client, wallet.address);
    marketService = new MarketService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('CreateEscrow', () => {
    it('should create escrow successfully', async () => {
      const seller = await createTestWallet();
      const amount = BigInt(1000000);

      const result = await marketService.createEscrow({
        buyer: wallet.address,
        seller: seller.address,
        tokenId: null,
        amount,
        expiry: BigInt(Date.now() + 3600000), // 1小时后过期
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.escrowId).toBeDefined();
    }, 60000);
  });

  describe('CreateVesting', () => {
    it('should create vesting successfully', async () => {
      const recipient = await createTestWallet();
      const amount = BigInt(1000000);
      const unlockTime = Math.floor(Date.now() / 1000) + 3600; // 1小时后解锁

      const result = await marketService.createVesting({
        from: wallet.address,
        to: recipient.address,
        tokenId: null,
        amount,
        startTime: BigInt(unlockTime),
        duration: BigInt(3600), // 1小时
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.vestingId).toBeDefined();
    }, 60000);
  });
});

