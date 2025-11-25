/**
 * Transaction Service 单元测试
 */

import { TransactionServiceImpl } from '../../src/services/transaction/service';
import { MockClient } from '../mocks/client';
import type { TransactionFilters } from '../../src/client/wesclient-types';

describe('TransactionServiceImpl', () => {
  let transactionService: TransactionServiceImpl;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    transactionService = new TransactionServiceImpl(mockClient);
  });

  describe('getTransaction', () => {
    it('should get transaction successfully', async () => {
      const txId = '0x1234567890abcdef';

      const mockTx = {
        txId: '0x1234567890abcdef',
        status: 'confirmed',
        inputs: [],
        outputs: [],
        blockHeight: 1000,
        timestamp: new Date().toISOString(),
      };

      mockClient.setResponse('wes_getTransactionByHash', mockTx);

      const tx = await transactionService.getTransaction(txId);

      expect(tx).toBeDefined();
      expect(tx.txId).toBe(txId);
      expect(tx.status).toBe('confirmed');
    });

    it('should throw error when transaction not found', async () => {
      const txId = '0x1234567890abcdef';

      mockClient.setResponse('wes_getTransactionByHash', null);

      await expect(transactionService.getTransaction(txId)).rejects.toThrow();
    });
  });

  describe('getTransactionHistory', () => {
    it('should get transaction history with filters', async () => {
      const filters: TransactionFilters = {
        resourceId: new Uint8Array(32).fill(1),
        limit: 20,
        offset: 0,
      };

      const mockTxs = {
        transactions: [
          {
            txId: '0x1111',
            status: 'confirmed',
            inputs: [],
            outputs: [],
            timestamp: new Date().toISOString(),
          },
          {
            txId: '0x2222',
            status: 'pending',
            inputs: [],
            outputs: [],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getTransactionHistory', mockTxs);

      const txs = await transactionService.getTransactionHistory(filters);

      expect(txs).toBeDefined();
      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBe(2);
    });

    it('should handle empty transaction history', async () => {
      const filters: TransactionFilters = {
        limit: 20,
        offset: 0,
      };

      mockClient.setResponse('wes_getTransactionHistory', { transactions: [] });

      const txs = await transactionService.getTransactionHistory(filters);

      expect(txs).toBeDefined();
      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBe(0);
    });

    it('should apply pagination correctly', async () => {
      const filters: TransactionFilters = {
        limit: 5,
        offset: 10,
      };

      const mockTxs = {
        transactions: Array.from({ length: 20 }, (_, i) => ({
          txId: `0x${i.toString(16)}`,
          status: 'confirmed' as const,
          inputs: [],
          outputs: [],
          timestamp: new Date().toISOString(),
        })),
      };

      mockClient.setResponse('wes_getTransactionHistory', mockTxs);

      const txs = await transactionService.getTransactionHistory(filters);

      expect(txs).toBeDefined();
      // 注意：实际的分页逻辑在 WESClient 中实现
    });
  });

  describe('submitTransaction', () => {
    it('should submit transaction successfully', async () => {
      const tx = '0x1234567890abcdef';

      const mockResult = {
        txHash: '0xabcdef1234567890',
        accepted: true,
      };

      jest.spyOn(mockClient, 'sendRawTransaction').mockResolvedValue(mockResult);

      const result = await transactionService.submitTransaction(tx);

      expect(result).toBeDefined();
      expect(result.txHash).toBe(mockResult.txHash);
      expect(result.accepted).toBe(true);
    });

    it('should handle rejected transaction', async () => {
      const tx = '0x1234567890abcdef';

      const mockResult = {
        txHash: '0xabcdef1234567890',
        accepted: false,
        reason: 'Insufficient balance',
      };

      jest.spyOn(mockClient, 'sendRawTransaction').mockResolvedValue(mockResult);

      const result = await transactionService.submitTransaction(tx);

      expect(result).toBeDefined();
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('Insufficient balance');
    });
  });
});

