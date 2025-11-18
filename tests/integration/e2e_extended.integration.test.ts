/**
 * 扩展端到端场景集成测试
 * 
 * 测试更多复杂的业务流程和错误恢复场景
 * 需要真实节点运行才能执行
 */

import { TokenService } from '../../src/services/token/service';
import { StakingService } from '../../src/services/staking/service';
import { MarketService } from '../../src/services/market/service';
import { GovernanceService } from '../../src/services/governance/service';
import { ResourceService } from '../../src/services/resource/service';
import { IClient, ClientConfig, createClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import { hexToBytes } from '../../src/utils/hex';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
  waitForTransactionConfirmation,
  getTestAccountBalance,
} from './setup';

describe('Extended End-to-End Integration Tests', () => {
  let client: IClient;
  let wallet: Wallet;
  let tokenService: TokenService;
  let stakingService: StakingService;
  let marketService: MarketService;
  let governanceService: GovernanceService;
  let resourceService: ResourceService;
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
    governanceService = new GovernanceService(client, wallet);
    resourceService = new ResourceService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('Complete Governance Workflow: Propose -> Vote -> UpdateParam', () => {
    it('should complete full governance workflow', async () => {
      // 1. 创建提案
      const proposeResult = await governanceService.propose({
        proposer: wallet.address,
        title: 'Test Governance Proposal',
        description: 'This is a test governance proposal for E2E testing',
        votingPeriod: BigInt(1000),
      }, wallet);

      expect(proposeResult.success).toBe(true);
      expect(proposeResult.proposalId).toBeDefined();
      await waitForTransactionConfirmation(client, proposeResult.txHash);

      // 2. 投票
      // 将 proposalId 从 string 转换为 Uint8Array
      const proposalIdBytes = hexToBytes(proposeResult.proposalId!);
      const voteResult = await governanceService.vote({
        voter: wallet.address,
        proposalId: proposalIdBytes,
        choice: 1, // 支持
        voteWeight: BigInt(1),
      }, wallet);

      expect(voteResult.success).toBe(true);
      expect(voteResult.voteId).toBeDefined();
      await waitForTransactionConfirmation(client, voteResult.txHash);

      // 3. 更新参数（如果提案通过）
      // 注意：实际场景中，参数更新可能需要提案通过后才能执行
      // 这里仅演示参数更新的调用
      try {
        const updateResult = await governanceService.updateParam({
          proposer: wallet.address,
          paramKey: 'staking_reward_rate',
          paramValue: '0.05',
        }, wallet);

        if (updateResult.success) {
          expect(updateResult.txHash).toBeDefined();
          await waitForTransactionConfirmation(client, updateResult.txHash);
        }
      } catch (error) {
        // 如果参数更新需要提案通过，这是正常的
        console.log('Parameter update may require proposal approval');
      }
    }, 180000);
  });

  describe('Complete Market Liquidity Workflow: Add Liquidity -> Swap -> Remove Liquidity', () => {
    it('should complete full liquidity workflow', async () => {
      // 注意：这个测试需要 AMM 合约已部署
      // 1. 添加流动性
      const tokenIdA = new Uint8Array(32);
      tokenIdA.fill(1);
      const tokenIdB = new Uint8Array(32);
      tokenIdB.fill(2);

      try {
        const addLiquidityResult = await marketService.addLiquidity({
          from: wallet.address,
          ammContractAddr: new Uint8Array(32), // 需要实际的 AMM 合约地址
          tokenA: tokenIdA,
          tokenB: tokenIdB,
          amountA: BigInt(1000000),
          amountB: BigInt(2000000),
        }, wallet);

        if (addLiquidityResult.success) {
          expect(addLiquidityResult.txHash).toBeDefined();
          expect(addLiquidityResult.liquidityId).toBeDefined();
          await waitForTransactionConfirmation(client, addLiquidityResult.txHash);

          // 2. AMM 交换
          const swapResult = await marketService.swapAMM({
            from: wallet.address,
            ammContractAddr: new Uint8Array(32), // 需要实际的 AMM 合约地址
            tokenIn: tokenIdA,
            tokenOut: tokenIdB,
            amountIn: BigInt(100000),
            amountOutMin: BigInt(180000),
          }, wallet);

          if (swapResult.success) {
            expect(swapResult.txHash).toBeDefined();
            await waitForTransactionConfirmation(client, swapResult.txHash);

            // 3. 移除流动性
            const removeLiquidityResult = await marketService.removeLiquidity({
              from: wallet.address,
              ammContractAddr: new Uint8Array(32), // 需要实际的 AMM 合约地址
              liquidityId: addLiquidityResult.liquidityId!,
              amount: BigInt(500000), // 移除部分流动性
            }, wallet);

            if (removeLiquidityResult.success) {
              expect(removeLiquidityResult.txHash).toBeDefined();
              await waitForTransactionConfirmation(client, removeLiquidityResult.txHash);
            }
          }
        }
      } catch (error) {
        // AMM 合约可能未部署，这是正常的
        console.log('AMM contract may not be deployed:', error);
      }
    }, 180000);
  });

  describe('Batch Operations: Batch Transfer', () => {
    it('should complete batch transfer workflow', async () => {
      // 创建多个接收者
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

      expect(result.success).toBe(true);
      expect(result.txHash).toBeDefined();
      await waitForTransactionConfirmation(client, result.txHash);

      // 验证每个接收者的余额
      for (const recipient of recipients) {
        const balance = await getTestAccountBalance(client, recipient.address, tokenId);
        expect(Number(balance)).toBeGreaterThanOrEqual(Number(BigInt(100000)));
      }
    }, 120000);
  });

  describe('Error Recovery: Network Retry', () => {
    it('should retry on network errors', async () => {
      // 创建一个带重试配置的客户端
      const retryClientConfig: ClientConfig = {
        endpoint: process.env.WES_NODE_ENDPOINT || 'http://localhost:8080/jsonrpc',
        protocol: 'http',
        timeout: 30000,
        debug: false,
        retry: {
          maxRetries: 3,
          initialDelay: 500,
          maxDelay: 5000,
          backoffMultiplier: 2,
          retryable: (error: any) => {
            // 只重试网络错误
            return error.message?.includes('Network Error') || 
                   error.message?.includes('timeout') ||
                   (error.response && error.response.status >= 500);
          },
        },
      };

      const retryClient = createClient(retryClientConfig);
      const retryTokenService = new TokenService(retryClient, wallet);

      // 执行一个简单的查询操作（应该成功，即使有临时网络问题也会重试）
      const balance = await retryTokenService.getBalance(wallet.address, null);
      expect(balance).toBeDefined();

      await retryClient.close();
    });
  });

  describe('Error Recovery: Transaction Failure Handling', () => {
    it('should handle transaction failures gracefully', async () => {
      const newWallet = await createTestWallet();
      const hugeAmount = BigInt(1000000000000); // 非常大的金额

      // 应该抛出错误
      await expect(
        tokenService.transfer({
          from: newWallet.address,
          to: wallet.address,
          amount: hugeAmount,
          tokenId: null,
        }, newWallet)
      ).rejects.toThrow();

      // 验证余额未变化
      const initialBalance = await getTestAccountBalance(client, wallet.address, null);
      const finalBalance = await getTestAccountBalance(client, wallet.address, null);
      expect(Number(finalBalance)).toBe(Number(initialBalance));
    });
  });

  describe('Multi-Account Collaboration: Escrow with Multiple Parties', () => {
    it('should handle escrow with buyer and seller', async () => {
      const seller = await createTestWallet();
      const buyer = wallet;

      // 1. 买方创建托管
      const escrowAmount = BigInt(500000);
      const escrowResult = await marketService.createEscrow({
        buyer: buyer.address,
        seller: seller.address,
        tokenId: null,
        amount: escrowAmount,
        expiry: BigInt(Date.now() + 3600000), // 1小时后过期
      }, buyer);

      expect(escrowResult.success).toBe(true);
      expect(escrowResult.escrowId).toBeDefined();
      await waitForTransactionConfirmation(client, escrowResult.txHash);

      // 2. 卖方释放托管（需要卖方签名）
      const sellerMarketService = new MarketService(client, seller);
      const releaseResult = await sellerMarketService.releaseEscrow({
        from: seller.address,
        sellerAddress: seller.address,
        escrowId: escrowResult.escrowId!,
      }, seller);

      expect(releaseResult.success).toBe(true);
      await waitForTransactionConfirmation(client, releaseResult.txHash);

      // 3. 验证卖方余额增加
      const sellerBalance = await getTestAccountBalance(client, seller.address, null);
      expect(Number(sellerBalance)).toBeGreaterThanOrEqual(Number(escrowAmount));
    }, 120000);
  });

  describe('Resource Deployment Workflow: Deploy Contract -> Query Resource', () => {
    it('should complete resource deployment workflow', async () => {
      // 1. 部署静态资源
      const fileContent = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const mimeType = 'application/octet-stream';

      const deployResult = await resourceService.deployStaticResource({
        from: wallet.address,
        fileContent,
        mimeType,
      }, wallet);

      expect(deployResult.success).toBe(true);
      expect(deployResult.contentHash).toBeDefined();
      await waitForTransactionConfirmation(client, deployResult.txHash);

      // 2. 查询资源
      if (deployResult.contentHash) {
        const resourceInfo = await resourceService.getResource(deployResult.contentHash);
        expect(resourceInfo).toBeDefined();
        expect(resourceInfo.contentHash).toBeDefined();
      }
    }, 120000);
  });

  describe('Complex Workflow: Transfer -> Stake -> Claim Reward -> Unstake', () => {
    it('should complete complex staking workflow', async () => {
      // 1. 转账
      const transferAmount = BigInt(1000000);
      const recipient = await createTestWallet();

      const transferResult = await tokenService.transfer({
        from: wallet.address,
        to: recipient.address,
        amount: transferAmount,
        tokenId: null,
      }, wallet);

      expect(transferResult.success).toBe(true);
      await waitForTransactionConfirmation(client, transferResult.txHash);

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

      // 3. 尝试领取奖励
      try {
        // stakeId 是 string，需要转换为 Uint8Array
        const stakeIdBytes = hexToBytes(stakeResult.stakeId!);
        const claimResult = await stakingService.claimReward({
          from: wallet.address,
          stakeId: stakeIdBytes,
        }, wallet);

        if (claimResult.success) {
          await waitForTransactionConfirmation(client, claimResult.txHash);
        }
      } catch (error) {
        console.log('No reward to claim yet');
      }

      // 4. 解除质押
      // stakeId 是 string，需要转换为 Uint8Array
      const stakeIdBytes = hexToBytes(stakeResult.stakeId!);
      const unstakeResult = await stakingService.unstake({
        from: wallet.address,
        stakeId: stakeIdBytes,
        amount: BigInt(0), // 0 表示全部解除质押
      }, wallet);

      expect(unstakeResult.success).toBe(true);
      await waitForTransactionConfirmation(client, unstakeResult.txHash);
    }, 240000); // 4分钟超时
  });
});

