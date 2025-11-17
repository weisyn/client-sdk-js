/**
 * 浏览器兼容性工具测试
 */

import {
  getEnvironment,
  getEnvironmentInfo,
  supportsWebCrypto,
  supportsNodeCrypto,
  supportsFileSystem,
  requireFeature,
  BrowserCompatibilityError,
} from '../../src/utils/browser';

describe('Browser Compatibility Utils', () => {
  describe('getEnvironment', () => {
    it('should detect environment', () => {
      const env = getEnvironment();
      expect(['node', 'browser', 'unknown']).toContain(env);
    });
  });

  describe('getEnvironmentInfo', () => {
    it('should return environment info', () => {
      const info = getEnvironmentInfo();
      expect(info).toHaveProperty('environment');
      expect(info).toHaveProperty('supportsWebCrypto');
      expect(info).toHaveProperty('supportsNodeCrypto');
      expect(info).toHaveProperty('supportsFileSystem');
    });
  });

  describe('supportsWebCrypto', () => {
    it('should check Web Crypto API support', () => {
      const supported = supportsWebCrypto();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('supportsNodeCrypto', () => {
    it('should check Node.js crypto support', () => {
      const supported = supportsNodeCrypto();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('supportsFileSystem', () => {
    it('should check file system support', () => {
      const supported = supportsFileSystem();
      expect(typeof supported).toBe('boolean');
    });
  });

  describe('requireFeature', () => {
    it('should throw error if feature not available', () => {
      expect(() => {
        requireFeature('test', () => false, 'Test feature not available');
      }).toThrow(BrowserCompatibilityError);
    });

    it('should not throw if feature available', () => {
      expect(() => {
        requireFeature('test', () => true, 'Test feature not available');
      }).not.toThrow();
    });
  });
});

