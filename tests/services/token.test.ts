/**
 * Token Service 单元测试
 */

import { TokenService } from '../../src/services/token/service';
import { Wallet } from '../../src/wallet/wallet';
import { MockClient } from '../mocks/client';

describe('TokenService', () => {
  let tokenService: TokenService;
  let mockClient: MockClient;
  let wallet: Wallet;

  beforeEach(async () => {
    mockClient = new MockClient();
    wallet = await Wallet.create();
    tokenService = new TokenService(mockClient, wallet);
  });

  describe('transfer', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        tokenService.transfer({
          from: invalidAddress,
          to: wallet.address,
          amount: 1000,
          tokenId: null,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate to address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        tokenService.transfer({
          from: wallet.address,
          to: invalidAddress,
          amount: 1000,
          tokenId: null,
        })
      ).rejects.toThrow('To address must be 20 bytes');
    });

    it('should validate amount', async () => {
      await expect(
        tokenService.transfer({
          from: wallet.address,
          to: wallet.address,
          amount: 0,
          tokenId: null,
        })
      ).rejects.toThrow('Amount must be greater than 0');
    });

    it('should validate wallet address match', async () => {
      const otherWallet = await Wallet.create();
      await expect(
        tokenService.transfer({
          from: otherWallet.address,
          to: wallet.address,
          amount: 1000,
          tokenId: null,
        })
      ).rejects.toThrow('Wallet address does not match from address');
    });

    // 注意：完整的集成测试需要真实的节点连接
    // 这里只测试参数验证逻辑
  });

  describe('batchTransfer', () => {
    it('should validate at least one transfer', async () => {
      await expect(
        tokenService.batchTransfer({
          from: wallet.address,
          transfers: [],
          tokenId: new Uint8Array(32),
        })
      ).rejects.toThrow('At least one transfer is required');
    });

    it('should validate tokenID length', async () => {
      await expect(
        tokenService.batchTransfer({
          from: wallet.address,
          transfers: [{ to: wallet.address, amount: 100 }],
          tokenId: new Uint8Array(31), // 错误长度
        })
      ).rejects.toThrow('TokenID is required and must be 32 bytes');
    });

    it('should validate all transfer recipients', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        tokenService.batchTransfer({
          from: wallet.address,
          transfers: [
            { to: wallet.address, amount: 100 },
            { to: invalidAddress, amount: 200 },
          ],
          tokenId: new Uint8Array(32),
        })
      ).rejects.toThrow('All transfer recipients must have 20-byte addresses');
    });
  });

  describe('getBalance', () => {
    it('should validate address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        tokenService.getBalance(invalidAddress, null)
      ).rejects.toThrow('Address must be 20 bytes');
    });

    // 注意：余额查询需要真实的节点连接
    // 这里只测试参数验证逻辑
  });
});

