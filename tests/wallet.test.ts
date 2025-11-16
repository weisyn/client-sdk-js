/**
 * Wallet 单元测试
 */

import { Wallet } from '../src/wallet/wallet';
import { bytesToHex } from '../src/utils/hex';

describe('Wallet', () => {
  describe('create', () => {
    it('should create a new wallet', async () => {
      const wallet = await Wallet.create();
      
      expect(wallet).toBeDefined();
      expect(wallet.address).toBeDefined();
      expect(wallet.address.length).toBe(20);
      expect(wallet.publicKey).toBeDefined();
    });

    it('should create different wallets each time', async () => {
      const wallet1 = await Wallet.create();
      const wallet2 = await Wallet.create();
      
      expect(wallet1.address).not.toEqual(wallet2.address);
    });
  });

  describe('fromPrivateKey', () => {
    it('should create wallet from private key', async () => {
      // 创建一个钱包并导出私钥
      const originalWallet = await Wallet.create();
      const privateKey = originalWallet.exportPrivateKey();
      
      // 从私钥恢复钱包
      const restoredWallet = await Wallet.fromPrivateKey(privateKey);
      
      expect(restoredWallet.address).toEqual(originalWallet.address);
    });

    it('should handle private key with 0x prefix', async () => {
      const wallet1 = await Wallet.create();
      const privateKey = wallet1.exportPrivateKey();
      
      const wallet2 = await Wallet.fromPrivateKey(`0x${privateKey}`);
      
      expect(wallet2.address).toEqual(wallet1.address);
    });

    it('should throw error for invalid private key length', async () => {
      await expect(Wallet.fromPrivateKey('0x1234')).rejects.toThrow('Invalid private key length');
    });

    it('should throw error for invalid private key', async () => {
      // 全零的私钥是无效的
      const invalidKey = '0x' + '0'.repeat(64);
      await expect(Wallet.fromPrivateKey(invalidKey)).rejects.toThrow();
    });
  });

  describe('signTransaction', () => {
    it('should sign transaction', async () => {
      const wallet = await Wallet.create();
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      
      const signature = await wallet.signTransaction(message);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // secp256k1 签名是 64 字节
    });

    it('should produce different signatures for different messages', async () => {
      const wallet = await Wallet.create();
      const message1 = new Uint8Array([1, 2, 3]);
      const message2 = new Uint8Array([4, 5, 6]);
      
      const sig1 = await wallet.signTransaction(message1);
      const sig2 = await wallet.signTransaction(message2);
      
      expect(sig1).not.toEqual(sig2);
    });
  });

  describe('signMessage', () => {
    it('should sign message', async () => {
      const wallet = await Wallet.create();
      const message = new Uint8Array([1, 2, 3, 4, 5]);
      
      const signature = await wallet.signMessage(message);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });
  });

  describe('exportPrivateKey', () => {
    it('should export private key', async () => {
      const wallet = await Wallet.create();
      const privateKey = wallet.exportPrivateKey();
      
      expect(privateKey).toBeDefined();
      expect(privateKey.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('getAddressHex', () => {
    it('should return address as hex string', async () => {
      const wallet = await Wallet.create();
      const addressHex = wallet.getAddressHex();
      
      expect(addressHex).toBeDefined();
      expect(addressHex.startsWith('0x')).toBe(true);
      expect(addressHex.length).toBe(42); // 0x + 20 bytes = 42 chars
    });
  });
});

