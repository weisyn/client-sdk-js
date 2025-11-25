/**
 * WESClient 失败场景测试
 */

import { WESClientImpl, WESClientError } from '../../src/client/wesclient';
import { MockClient } from '../mocks/client';
import { JSONRPCError } from '../../src/client/errors';
// OutPoint imported but not used in tests - keeping for potential future use
// import type { OutPoint } from '../../src/client/wesclient-types';

describe('WESClientImpl Failure Scenarios', () => {
  let wesClient: WESClientImpl;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    wesClient = new WESClientImpl(mockClient);
  });

  describe('submitTransaction failures', () => {
    it('should handle insufficient balance error', async () => {
      const tx = '0x1234567890abcdef';

      // 模拟余额不足错误
      const mockResult = {
        txHash: '0xabcdef1234567890',
        accepted: false,
        reason: 'Insufficient balance',
      };

      jest.spyOn(mockClient, 'sendRawTransaction').mockResolvedValue(mockResult);

      const result = await wesClient.submitTransaction(tx);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('Insufficient balance');
    });

    it('should handle network error', async () => {
      const tx = '0x1234567890abcdef';

      jest
        .spyOn(mockClient, 'sendRawTransaction')
        .mockRejectedValue(new Error('Network error'));

      await expect(wesClient.submitTransaction(tx)).rejects.toThrow();
    });

    it('should handle RPC error', async () => {
      const tx = '0x1234567890abcdef';

      jest
        .spyOn(mockClient, 'sendRawTransaction')
        .mockRejectedValue(new JSONRPCError('RPC error', -32000));

      await expect(wesClient.submitTransaction(tx)).rejects.toThrow(WESClientError);
    });
  });

  describe('RPC_NOT_IMPLEMENTED errors', () => {
    it('should handle method not found error', async () => {
      const address = new Uint8Array(20).fill(1);

      jest.spyOn(mockClient, 'call').mockRejectedValue(
        new JSONRPCError('Method not found', -32601)
      );

      await expect(wesClient.listUTXOs(address)).rejects.toThrow(WESClientError);
    });

    it('should handle RPC_NOT_IMPLEMENTED error code', async () => {
      const resourceId = new Uint8Array(32).fill(1);

      jest.spyOn(mockClient, 'call').mockRejectedValue(
        new JSONRPCError('RPC not implemented', -32000)
      );

      await expect(wesClient.getResource(resourceId)).rejects.toThrow(WESClientError);
    });
  });

  describe('INVALID_PARAMS errors', () => {
    it('should handle invalid params error', async () => {
      const address = new Uint8Array(19); // 无效的地址长度（应该是20字节）

      jest.spyOn(mockClient, 'call').mockRejectedValue(
        new JSONRPCError('Invalid params', -32602)
      );

      await expect(wesClient.listUTXOs(address)).rejects.toThrow(WESClientError);
    });
  });

  describe('NOT_FOUND errors', () => {
    it('should handle resource not found', async () => {
      const resourceId = new Uint8Array(32).fill(1);

      mockClient.setResponse('wes_getResource', null);

      await expect(wesClient.getResource(resourceId)).rejects.toThrow();
    });

    it('should handle transaction not found', async () => {
      const txId = '0x9999999999999999';

      mockClient.setResponse('wes_getTransactionByHash', null);

      await expect(wesClient.getTransaction(txId)).rejects.toThrow();
    });
  });

  describe('DECODE_FAILED errors', () => {
    it('should handle invalid UTXO response format', async () => {
      const address = new Uint8Array(20).fill(1);

      // 返回无效格式（不是对象或缺少 utxos 字段）
      mockClient.setResponse('wes_getUTXO', 'invalid format');

      await expect(wesClient.listUTXOs(address)).rejects.toThrow();
    });

    it('should handle invalid resource response format', async () => {
      const resourceId = new Uint8Array(32).fill(1);

      // 返回无效格式
      mockClient.setResponse('wes_getResource', null);

      await expect(wesClient.getResource(resourceId)).rejects.toThrow();
    });
  });
});

