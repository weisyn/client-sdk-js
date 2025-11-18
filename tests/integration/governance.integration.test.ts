/**
 * Governance Service 集成测试
 * 
 * 需要真实节点运行才能执行
 */

import { GovernanceService } from '../../src/services/governance/service';
import { IClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import { hexToBytes } from '../../src/utils/hex';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  fundTestAccount,
  ensureNodeRunning,
  waitForTransactionConfirmation,
} from './setup';

describe('Governance Service Integration Tests', () => {
  let client: IClient;
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
      const result = await governanceService.propose({
        proposer: wallet.address,
        title: 'Test Proposal',
        description: 'This is a test proposal',
        votingPeriod: BigInt(1000),
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
      const proposeResult = await governanceService.propose({
        proposer: wallet.address,
        title: 'Test Proposal for Voting',
        description: 'This is a test proposal for voting',
        votingPeriod: BigInt(1000),
      }, wallet);

      // 等待提案确认
      await waitForTransactionConfirmation(client, proposeResult.txHash);

      // 投票 - 将 proposalId 从 string 转换为 Uint8Array
      const proposalIdBytes = hexToBytes(proposeResult.proposalId!);
      const result = await governanceService.vote({
        voter: wallet.address,
        proposalId: proposalIdBytes,
        choice: 1, // 支持
        voteWeight: BigInt(1),
      }, wallet);

      expect(result).toBeDefined();
      expect(result.txHash).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.voteId).toBeDefined();
    }, 120000);
  });
});

