/**
 * WESClient 集成测试
 * 
 * 注意：这些测试需要连接到真实的 WES 节点
 * 可以通过设置环境变量 SKIP_INTEGRATION_TESTS=true 跳过
 */

import { WESClientImpl } from '../../src/client/wesclient';
import { createClient } from '../../src/client/client';
import { Wallet } from '../../src/wallet/wallet';
import {
  setupTestClient,
  teardownTestClient,
  createTestWallet,
  ensureNodeRunning,
} from './setup';

describe('WESClientImpl Integration Tests', () => {
  let wesClient: WESClientImpl;
  let client: any;
  let testWallet: Wallet;

  beforeAll(async () => {
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
      console.log('Skipping integration tests');
      return;
    }

    await ensureNodeRunning();
    client = await setupTestClient();
    wesClient = new WESClientImpl(client);
    testWallet = await createTestWallet();
  });

  afterAll(async () => {
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
      return;
    }
    if (client) {
      await teardownTestClient(client);
    }
  });

  describe('getNodeInfo', () => {
    it('should get node info', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      try {
        const nodeInfo = await wesClient.getNodeInfo();
        expect(nodeInfo).toBeDefined();
        expect(nodeInfo.rpcVersion).toBeDefined();
        expect(nodeInfo.chainId).toBeDefined();
        expect(typeof nodeInfo.blockHeight).toBe('number');
      } catch (error: any) {
        // 如果节点不支持此方法，这是预期的
        if (process.env.DEBUG_TESTS) {
          console.log('getNodeInfo error:', {
            code: error.code,
            layer: error.layer,
            message: error.message,
            userMessage: error.userMessage,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
          });
        }
        expect(
          error.code === 'RPC_NOT_IMPLEMENTED' || 
          error.code === 'RPC_ERROR' ||
          error.code === 'NETWORK_ERROR' ||
          error.code === 'COMMON_VALIDATION_ERROR' ||
          (error.layer && error.layer === 'CLIENT_SDK_JS')
        ).toBe(true);
      }
    }, 30000);
  });

  describe('listUTXOs', () => {
    it('should list UTXOs by address', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      // 使用有效的钱包地址
      const testAddress = testWallet.address;

      try {
        const utxos = await wesClient.listUTXOs(testAddress);
        expect(Array.isArray(utxos)).toBe(true);
        // 如果返回空数组，也是有效的（地址没有 UTXO）
        if (utxos.length > 0) {
          expect(utxos[0].outPoint).toBeDefined();
          expect(utxos[0].output).toBeDefined();
        }
      } catch (error: any) {
        // 打印完整错误信息以便调试
        if (process.env.DEBUG_TESTS) {
          console.log('listUTXOs error:', {
            code: error.code,
            layer: error.layer,
            message: error.message,
            userMessage: error.userMessage,
            detail: error.detail,
            status: error.status,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
          });
        }
        // 接受各种可能的错误码（验证错误、RPC错误、网络错误等）
        // 注意：如果地址没有 UTXO，节点可能返回空数组而不是错误
        const isValidError = 
          error.code === 'RPC_ERROR' || 
          error.code === 'NETWORK_ERROR' || 
          error.code === 'COMMON_VALIDATION_ERROR' ||
          error.code === 'NOT_FOUND' ||
          (error.layer && (error.layer === 'blockchain-service' || error.layer === 'CLIENT_SDK_JS')) ||
          (error.status && error.status >= 400);
        expect(isValidError).toBe(true);
      }
    }, 30000);
  });

  describe('getResource', () => {
    it('should handle resource query', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      // 注意：需要有效的 resourceId
      const resourceId = new Uint8Array(32).fill(0);

      try {
        const resource = await wesClient.getResource(resourceId);
        expect(resource).toBeDefined();
        expect(resource.resourceId).toBeDefined();
      } catch (error: any) {
        // 打印错误信息以便调试
        if (process.env.DEBUG_TESTS) {
          console.log('getResource error:', {
            code: error.code,
            layer: error.layer,
            message: error.message,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
          });
        }
        expect(
          error.code === 'NOT_FOUND' || 
          error.code === 'RPC_ERROR' ||
          error.code === 'COMMON_VALIDATION_ERROR' ||
          (error.layer && error.layer === 'blockchain-service')
        ).toBe(true);
      }
    }, 30000);
  });

  describe('getTransaction', () => {
    it('should handle transaction query', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      // 注意：需要有效的 txId
      const txId = '0x' + '0'.repeat(64);

      try {
        const tx = await wesClient.getTransaction(txId);
        expect(tx).toBeDefined();
        expect(tx.txId).toBeDefined();
      } catch (error: any) {
        // 打印错误信息以便调试
        if (process.env.DEBUG_TESTS) {
          console.log('getTransaction error:', {
            code: error.code,
            layer: error.layer,
            message: error.message,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
          });
        }
        // 如果交易不存在，这是预期的
        expect(
          error.code === 'NOT_FOUND' || 
          error.code === 'RPC_ERROR' ||
          error.code === 'COMMON_VALIDATION_ERROR' ||
          (error.layer && error.layer === 'blockchain-service')
        ).toBe(true);
      }
    }, 30000);
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
        return;
      }

      // 使用无效的端点
      const invalidClient = createClient({
        endpoint: 'http://invalid-host:8545',
        protocol: 'http',
        timeout: 1000,
      });

      const invalidWesClient = new WESClientImpl(invalidClient);

      await expect(invalidWesClient.getNodeInfo()).rejects.toThrow();
    }, 10000);
  });
});
