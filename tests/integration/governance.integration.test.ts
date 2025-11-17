/**
 * Governance Service 集成测试
 * 
 * 需要真实节点运行才能执行
 */

import { GovernanceService } from '../../src/services/governance/service';
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

describe('Governance Service Integration Tests', () => {
  let client: Client;
  let wallet: Wallet;
  let governanceService: GovernanceService;

  beforeAll(async () => {
    await ensureNodeRunning();
  });

  beforeEach(async () => {
    client = await setupTestClient();
    wallet = await createTestWallet();
    await fundTestAccount(client, wallet.address);
    governanceService = new GovernanceService(client, wallet);
  });

  afterEach(async () => {
    await teardownTestClient(client);
  });

  describe('Propose', () => {
    it('should create proposal successfully', async () => {
      const proposalData = {
        title: 'Test Proposal',
        description: 'This is a test proposal',
        action: 'update_param',
        params: { key: 'test_key', value: 'test_value' },
      };

      const result = await governanceService.propose({
        proposer: wallet.address,
        proposalData,
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.proposalId).toBeDefined();
    }, 60000);
  });

  describe('Vote', () => {
    it('should vote on proposal successfully', async () => {
      // 先创建一个提案
      const proposalData = {
        title: 'Test Proposal for Voting',
        description: 'This is a test proposal for voting',
        action: 'update_param',
        params: { key: 'test_key', value: 'test_value' },
      };

      const proposeResult = await governanceService.propose({
        proposer: wallet.address,
        proposalData,
      }, wallet);

      // 等待提案确认
      await waitForTransactionConfirmation(client, proposeResult.txHash);

      // 投票
      const result = await governanceService.vote({
        voter: wallet.address,
        proposalId: proposeResult.proposalId!,
        choice: 1, // 支持
        weight: BigInt(1),
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.voteId).toBeDefined();
    }, 120000);
  });
});

