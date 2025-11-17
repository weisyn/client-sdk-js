/**
 * Staking Service 单元测试
 */

import { StakingService } from '../../src/services/staking/service';
import { Wallet } from '../../src/wallet/wallet';
import { MockClient } from '../mocks/client';

describe('StakingService', () => {
  let stakingService: StakingService;
  let mockClient: MockClient;
  let wallet: Wallet;

  beforeEach(async () => {
    mockClient = new MockClient();
    wallet = await Wallet.create();
    stakingService = new StakingService(mockClient, wallet);
  });

  describe('stake', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.stake({
          from: invalidAddress,
          validatorAddr: wallet.address,
          amount: 1000,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate validator address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.stake({
          from: wallet.address,
          validatorAddr: invalidAddress,
          amount: 1000,
        })
      ).rejects.toThrow('Validator address must be 20 bytes');
    });

    it('should validate amount', async () => {
      await expect(
        stakingService.stake({
          from: wallet.address,
          validatorAddr: wallet.address,
          amount: 0,
        })
      ).rejects.toThrow('Amount must be greater than 0');
    });
  });

  describe('unstake', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.unstake({
          from: invalidAddress,
          stakeId: new Uint8Array(32),
          amount: 1000,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate stakeId length', async () => {
      await expect(
        stakingService.unstake({
          from: wallet.address,
          stakeId: new Uint8Array(31), // 错误长度
          amount: 1000,
        })
      ).rejects.toThrow('Stake ID must be 32 bytes');
    });
  });

  describe('delegate', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.delegate({
          from: invalidAddress,
          validatorAddr: wallet.address,
          amount: 1000,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate validator address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.delegate({
          from: wallet.address,
          validatorAddr: invalidAddress,
          amount: 1000,
        })
      ).rejects.toThrow('Validator address must be 20 bytes');
    });
  });

  describe('slash', () => {
    it('should validate validator address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        stakingService.slash({
          validatorAddr: invalidAddress,
          amount: 1000,
          reason: 'Test reason',
        })
      ).rejects.toThrow('Validator address must be 20 bytes');
    });

    it('should validate amount', async () => {
      await expect(
        stakingService.slash({
          validatorAddr: wallet.address,
          amount: 0,
          reason: 'Test reason',
        })
      ).rejects.toThrow('Amount must be greater than 0');
    });

    it('should validate reason', async () => {
      await expect(
        stakingService.slash({
          validatorAddr: wallet.address,
          amount: 1000,
          reason: '',
        })
      ).rejects.toThrow('Reason is required');
    });

    it('should throw error for not implemented', async () => {
      await expect(
        stakingService.slash({
          validatorAddr: wallet.address,
          amount: 1000,
          reason: 'Test reason',
        })
      ).rejects.toThrow('Slash not implemented');
    });
  });
});

