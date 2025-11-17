/**
 * 地址工具函数测试
 */

import {
  addressToHex,
  hexToAddress,
  isValidAddress,
  addressBytesToBase58,
  addressBase58ToBytes,
  addressHexToBase58,
  addressBase58ToHex,
} from '../../src/utils/address';

describe('Address Utils', () => {
  const testAddress = new Uint8Array([
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
    0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0,
    0x12, 0x34, 0x56, 0x78,
  ]);

  describe('addressToHex', () => {
    it('should convert address to hex string', () => {
      const hex = addressToHex(testAddress);
      expect(hex).toMatch(/^0x[0-9a-f]{40}$/);
      expect(hex).toBe('0x123456789abcdef0123456789abcdef012345678');
    });
  });

  describe('hexToAddress', () => {
    it('should convert hex string to address', () => {
      const hex = '0x123456789abcdef0123456789abcdef012345678';
      const address = hexToAddress(hex);
      expect(address).toEqual(testAddress);
    });

    it('should handle hex without 0x prefix', () => {
      const hex = '123456789abcdef0123456789abcdef012345678';
      const address = hexToAddress(hex);
      expect(address).toEqual(testAddress);
    });
  });

  describe('isValidAddress', () => {
    it('should validate correct address bytes', () => {
      expect(isValidAddress(testAddress)).toBe(true);
    });

    it('should validate correct hex address', () => {
      expect(isValidAddress('0x123456789abcdef0123456789abcdef012345678')).toBe(true);
      expect(isValidAddress('123456789abcdef0123456789abcdef012345678')).toBe(true);
    });

    it('should reject invalid address bytes', () => {
      expect(isValidAddress(new Uint8Array(19))).toBe(false);
      expect(isValidAddress(new Uint8Array(21))).toBe(false);
    });

    it('should reject invalid hex address', () => {
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('invalid')).toBe(false);
    });
  });

  describe('Base58 address conversion', () => {
    it('should convert address bytes to Base58 and back', () => {
      const base58 = addressBytesToBase58(testAddress);
      expect(typeof base58).toBe('string');
      expect(base58.length).toBeGreaterThan(0);

      const decoded = addressBase58ToBytes(base58);
      expect(decoded).toEqual(testAddress);
    });

    it('should convert hex address to Base58 and back', () => {
      const hex = '0x123456789abcdef0123456789abcdef012345678';
      const base58 = addressHexToBase58(hex);
      expect(typeof base58).toBe('string');

      const decodedHex = addressBase58ToHex(base58);
      expect(decodedHex.toLowerCase()).toBe(hex.toLowerCase());
    });

    it('should validate Base58 checksum', () => {
      const base58 = addressBytesToBase58(testAddress);
      // 修改最后一个字符（破坏校验和）
      const invalidBase58 = base58.slice(0, -1) + 'X';
      
      expect(() => {
        addressBase58ToBytes(invalidBase58);
      }).toThrow('Invalid checksum');
    });
  });
});

