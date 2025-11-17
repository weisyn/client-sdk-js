/**
 * Governance Service 单元测试
 */

import { GovernanceService } from '../../src/services/governance/service';
import { Wallet } from '../../src/wallet/wallet';
import { MockClient } from '../mocks/client';

describe('GovernanceService', () => {
  let governanceService: GovernanceService;
  let mockClient: MockClient;
  let wallet: Wallet;

  beforeEach(async () => {
    mockClient = new MockClient();
    wallet = await Wallet.create();
    governanceService = new GovernanceService(mockClient, wallet);
  });

  describe('propose', () => {
    it('should validate proposer address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        governanceService.propose({
          proposer: invalidAddress,
          title: 'Test Proposal',
          description: 'Test Description',
          votingPeriod: BigInt(1000),
        })
      ).rejects.toThrow('Proposer address must be 20 bytes');
    });

    it('should validate title', async () => {
      await expect(
        governanceService.propose({
          proposer: wallet.address,
          title: '',
          description: 'Test Description',
          votingPeriod: BigInt(1000),
        })
      ).rejects.toThrow('Title is required');
    });

    it('should validate description', async () => {
      await expect(
        governanceService.propose({
          proposer: wallet.address,
          title: 'Test Proposal',
          description: '',
          votingPeriod: BigInt(1000),
        })
      ).rejects.toThrow('Description is required');
    });
  });

  describe('vote', () => {
    it('should validate voter address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        governanceService.vote({
          voter: invalidAddress,
          proposalId: new Uint8Array(32),
          choice: 1,
          voteWeight: BigInt(1000),
        })
      ).rejects.toThrow('Voter address must be 20 bytes');
    });

    it('should validate proposalId length', async () => {
      await expect(
        governanceService.vote({
          voter: wallet.address,
          proposalId: new Uint8Array(31), // 错误长度
          choice: 1,
          voteWeight: BigInt(1000),
        })
      ).rejects.toThrow('Proposal ID must be 32 bytes');
    });

    it('should validate choice value', async () => {
      await expect(
        governanceService.vote({
          voter: wallet.address,
          proposalId: new Uint8Array(32),
          choice: 2, // 无效选择（应该是 1, 0, -1）
          voteWeight: BigInt(1000),
        })
      ).rejects.toThrow('Choice must be 1 (支持), 0 (反对), or -1 (弃权)');
    });
  });

  describe('updateParam', () => {
    it('should validate proposer address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        governanceService.updateParam({
          proposer: invalidAddress,
          key: 'test_key',
          value: 'test_value',
        })
      ).rejects.toThrow('Proposer address must be 20 bytes');
    });

    it('should validate key', async () => {
      await expect(
        governanceService.updateParam({
          proposer: wallet.address,
          key: '',
          value: 'test_value',
        })
      ).rejects.toThrow('Key is required');
    });
  });
});

