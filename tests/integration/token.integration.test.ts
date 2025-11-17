/**
 * Token Service 集成测试
 * 
 * 需要真实节点运行才能执行
 * 设置环境变量 WES_NODE_ENDPOINT 指定节点端点（默认: http://localhost:8080/jsonrpc）
 */

import { TokenService } from '../../src/services/token/service';
import { Client } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  getTestAccountBalance,
  ensureNodeRunning,
  waitForTransactionConfirmation,
} from './setup';

describe('Token Service Integration Tests', () => {
  let client: Client;
  let wallet: Wallet;
  let tokenService: TokenService;

  beforeAll(async () => {
    // 确保节点运行
    await ensureNodeRunning();
  });

  beforeEach(async () => {
    // 设置测试客户端
    client = await setupTestClient();
    
    // 创建测试钱包
    wallet = await createTestWallet();
    
    // 为账户充值
    await fundTestAccount(client, wallet.address);
    
    // 创建 Token 服务
    tokenService = new TokenService(client, wallet);
  });

  afterEach(async () => {
    // 清理测试客户端
    await teardownTestClient(client);
  });

  describe('GetBalance', () => {
    it('should get balance for funded account', async () => {
      const balance = await tokenService.getBalance(wallet.address, null);
      
      expect(balance).toBeDefined();
      expect(Number(balance)).toBeGreaterThan(0);
    });

    it('should get zero balance for new account', async () => {
      const newWallet = await createTestWallet();
      const balance = await tokenService.getBalance(newWallet.address, null);
      
      expect(balance).toBeDefined();
      expect(Number(balance)).toBe(0);
    });

    it('should match direct UTXO query', async () => {
      const balance = await tokenService.getBalance(wallet.address, null);
      const directBalance = await getTestAccountBalance(client, wallet.address, null);
      
      expect(balance).toEqual(directBalance);
    });
  });

  describe('Transfer', () => {
    it('should transfer tokens successfully', async () => {
      const recipient = await createTestWallet();
      const amount = BigInt(1000000);

      // 获取初始余额
      const initialBalance = await getTestAccountBalance(client, recipient.address, null);

      // 执行转账
      const result = await tokenService.transfer({
        from: wallet.address,
        to: recipient.address,
        amount,
        tokenId: null,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);

      // 等待交易确认
      const confirmed = await waitForTransactionConfirmation(client, result.txHash);
      expect(confirmed).toBe(true);

      // 验证余额变化
      const finalBalance = await getTestAccountBalance(client, recipient.address, null);
      expect(Number(finalBalance - initialBalance)).toBeGreaterThanOrEqual(Number(amount));
    }, 60000); // 60秒超时

    it('should fail with insufficient balance', async () => {
      const recipient = await createTestWallet();
      const amount = BigInt(1000000000000); // 非常大的金额

      await expect(
        tokenService.transfer({
          from: wallet.address,
          to: recipient.address,
          amount,
          tokenId: null,
        }, wallet)
      ).rejects.toThrow();
    });
  });

  describe('BatchTransfer', () => {
    it('should batch transfer tokens successfully', async () => {
      const recipients = [
        await createTestWallet(),
        await createTestWallet(),
        await createTestWallet(),
      ];

      const transfers = recipients.map(recipient => ({
        to: recipient.address,
        amount: BigInt(100000),
      }));

      // 创建代币 ID（32 字节）
      const tokenId = new Uint8Array(32);
      tokenId.fill(1);

      // 执行批量转账
      const result = await tokenService.batchTransfer({
        from: wallet.address,
        transfers,
        tokenId,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
    }, 60000);
  });
});

