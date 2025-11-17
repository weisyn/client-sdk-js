/**
 * Market Service 单元测试
 */

import { MarketService } from '../../src/services/market/service';
import { Wallet } from '../../src/wallet/wallet';
import { MockClient } from '../mocks/client';

describe('MarketService', () => {
  let marketService: MarketService;
  let mockClient: MockClient;
  let wallet: Wallet;

  beforeEach(async () => {
    mockClient = new MockClient();
    wallet = await Wallet.create();
    marketService = new MarketService(mockClient, wallet);
  });

  describe('swapAMM', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.swapAMM({
          from: invalidAddress,
          ammContractAddr: new Uint8Array(32),
          amountIn: 1000,
          amountOutMin: 900,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate ammContractAddr length', async () => {
      await expect(
        marketService.swapAMM({
          from: wallet.address,
          ammContractAddr: new Uint8Array(31), // 错误长度
          amountIn: 1000,
          amountOutMin: 900,
        })
      ).rejects.toThrow('AMM contract address must be 32 bytes');
    });

    it('should validate amountIn', async () => {
      await expect(
        marketService.swapAMM({
          from: wallet.address,
          ammContractAddr: new Uint8Array(32),
          amountIn: 0,
          amountOutMin: 900,
        })
      ).rejects.toThrow('AmountIn must be greater than 0');
    });
  });

  describe('createEscrow', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.createEscrow({
          from: invalidAddress,
          buyer: wallet.address,
          seller: wallet.address,
          amount: 1000,
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate buyer address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.createEscrow({
          from: wallet.address,
          buyer: invalidAddress,
          seller: wallet.address,
          amount: 1000,
        })
      ).rejects.toThrow('Buyer address must be 20 bytes');
    });

    it('should validate seller address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.createEscrow({
          from: wallet.address,
          buyer: wallet.address,
          seller: invalidAddress,
          amount: 1000,
        })
      ).rejects.toThrow('Seller address must be 20 bytes');
    });
  });

  describe('createVesting', () => {
    it('should validate from address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.createVesting({
          from: invalidAddress,
          to: wallet.address,
          amount: 1000,
          tokenID: null,
          startTime: BigInt(1000),
          duration: BigInt(10000),
        })
      ).rejects.toThrow('From address must be 20 bytes');
    });

    it('should validate to address length', async () => {
      const invalidAddress = new Uint8Array(19);
      await expect(
        marketService.createVesting({
          from: wallet.address,
          to: invalidAddress,
          amount: 1000,
          tokenID: null,
          startTime: BigInt(1000),
          duration: BigInt(10000),
        })
      ).rejects.toThrow('To address must be 20 bytes');
    });
  });
});

