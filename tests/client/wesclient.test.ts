/**
 * WESClient 单元测试
 */

import { WESClientImpl, WESClientError } from '../../src/client/wesclient';
import { MockClient } from '../mocks/client';
// OutPoint imported but not used in tests - keeping for potential future use
// import type { OutPoint } from '../../src/client/wesclient-types';

describe('WESClientImpl', () => {
  let wesClient: WESClientImpl;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = new MockClient();
    wesClient = new WESClientImpl(mockClient);
  });

  describe('listUTXOs', () => {
    it('should list UTXOs by address successfully', async () => {
      const address = new Uint8Array(20).fill(1);

      const mockUTXOs = {
        utxos: [
          {
            outpoint: '0x1234567890abcdef:0',
            amount: '1000',
            height: '0x100',
            token_id: null,
          },
        ],
      };

      mockClient.setResponse('wes_getUTXO', mockUTXOs);

      const utxos = await wesClient.listUTXOs(address);

      expect(utxos).toBeDefined();
      expect(Array.isArray(utxos)).toBe(true);
      if (utxos.length > 0) {
        expect(utxos[0].outPoint).toBeDefined();
      }
    });

    it('should return empty array when address has no UTXOs', async () => {
      const address = new Uint8Array(20).fill(1);

      mockClient.setResponse('wes_getUTXO', { utxos: [] });

      const utxos = await wesClient.listUTXOs(address);

      expect(utxos).toBeDefined();
      expect(Array.isArray(utxos)).toBe(true);
      expect(utxos.length).toBe(0);
    });

    it('should wrap network errors', async () => {
      const address = new Uint8Array(20).fill(1);

      // 模拟网络错误
      jest.spyOn(mockClient, 'call').mockRejectedValue(new Error('Network error'));

      await expect(wesClient.listUTXOs(address)).rejects.toThrow();
    });
  });

  describe('getResource', () => {
    it('should get resource successfully', async () => {
      const resourceId = new Uint8Array(32).fill(1);

      const mockResource = {
        resourceId: '0x' + '01'.repeat(32),
        resourceType: 'contract',
        contentHash: '0x' + '01'.repeat(32),
        size: 1024,
        mimeType: 'application/wasm',
        lockingConditions: [],
        createdAt: new Date().toISOString(),
      };

      mockClient.setResponse('wes_getResource', mockResource);

      const resource = await wesClient.getResource(resourceId);

      expect(resource).toBeDefined();
      expect(resource.resourceType).toBe('contract');
      expect(resource.size).toBe(1024);
    });

    it('should throw error when resource not found', async () => {
      const resourceId = new Uint8Array(32).fill(1);

      mockClient.setResponse('wes_getResource', null);

      await expect(wesClient.getResource(resourceId)).rejects.toThrow();
    });
  });

  describe('getResources', () => {
    it('should get resources with filters', async () => {
      const filters = {
        resourceType: 'contract' as const,
        limit: 10,
        offset: 0,
      };

      const mockResources = {
        resources: [
          {
            resourceId: '0x' + '01'.repeat(32),
            resourceType: 'contract',
            contentHash: '0x' + '01'.repeat(32),
            size: 1024,
            lockingConditions: [],
            createdAt: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getResources', mockResources);

      const resources = await wesClient.getResources(filters);

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
    });

    it('should handle RPC not implemented error', async () => {
      const filters = {
        resourceType: 'contract' as const,
      };

      // 模拟 RPC 不存在
      jest.spyOn(mockClient, 'call').mockRejectedValue({
        rpcCode: -32601,
        message: 'Method not found',
      });

      await expect(wesClient.getResources(filters)).rejects.toThrow(WESClientError);
    });
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

      const tx = await wesClient.getTransaction(txId);

      expect(tx).toBeDefined();
      expect(tx.txId).toBe(txId);
      expect(tx.status).toBe('confirmed');
    });
  });

  describe('getTransactionHistory', () => {
    it('should get transaction history with filters', async () => {
      const filters = {
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
        ],
      };

      mockClient.setResponse('wes_getTransactionHistory', mockTxs);

      const txs = await wesClient.getTransactionHistory(filters);

      expect(txs).toBeDefined();
      expect(Array.isArray(txs)).toBe(true);
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

      const result = await wesClient.submitTransaction(tx);

      expect(result).toBeDefined();
      expect(result.txHash).toBe(mockResult.txHash);
      expect(result.accepted).toBe(true);
    });
  });

  describe('getEvents', () => {
    it('should get events with filters', async () => {
      const filters = {
        resourceId: new Uint8Array(32).fill(1),
        eventName: 'Transfer',
        limit: 10,
        offset: 0,
      };

      const mockEvents = {
        events: [
          {
            eventName: 'Transfer',
            resourceId: '0x' + '01'.repeat(32),
            data: '0x00',
            txId: '0x1111',
            blockHeight: 1000,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mockClient.setResponse('wes_getEvents', mockEvents);

      const events = await wesClient.getEvents(filters);

      expect(events).toBeDefined();
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('getNodeInfo', () => {
    it('should get node info successfully', async () => {
      mockClient.setResponse('wes_chainId', '0x1');
      mockClient.setResponse('wes_blockNumber', '0x3e8'); // 1000 in hex

      const nodeInfo = await wesClient.getNodeInfo();

      expect(nodeInfo).toBeDefined();
      expect(nodeInfo.chainId).toBe('0x1');
      expect(nodeInfo.blockHeight).toBe(1000);
      expect(nodeInfo.rpcVersion).toBe('1.0.0');
    });
  });


  describe('batchGetResources', () => {
    it('should batch get resources', async () => {
      const resourceIds = [
        new Uint8Array(32).fill(1),
        new Uint8Array(32).fill(2),
      ];

      mockClient.setResponse('wes_getResource', {
        resourceId: '0x' + '01'.repeat(32),
        resourceType: 'contract',
        contentHash: '0x' + '01'.repeat(32),
        size: 1024,
        lockingConditions: [],
        createdAt: new Date().toISOString(),
      });

      const resources = await wesClient.batchGetResources(resourceIds);

      expect(resources).toBeDefined();
      expect(resources.length).toBe(resourceIds.length);
    });
  });

  describe('error handling', () => {
    it('should wrap JSON-RPC errors correctly', async () => {
      const address = new Uint8Array(20).fill(1);

      // 模拟 INVALID_PARAMS 错误
      jest.spyOn(mockClient, 'call').mockRejectedValue({
        rpcCode: -32602,
        message: 'Invalid params',
      });

      await expect(wesClient.listUTXOs(address)).rejects.toThrow(WESClientError);
    });

    it('should wrap RPC_NOT_IMPLEMENTED errors', async () => {
      const address = new Uint8Array(20).fill(1);

      // 模拟 METHOD_NOT_FOUND 错误
      jest.spyOn(mockClient, 'call').mockRejectedValue({
        rpcCode: -32601,
        message: 'Method not found',
      });

      await expect(wesClient.listUTXOs(address)).rejects.toThrow(WESClientError);
    });
  });

  describe('close', () => {
    it('should close client connection', async () => {
      jest.spyOn(mockClient, 'close').mockResolvedValue(undefined);

      await wesClient.close();

      expect(mockClient.close).toHaveBeenCalled();
    });
  });
});

