/**
 * Jest 测试环境设置
 */

// 设置测试超时时间
jest.setTimeout(10000);

// Mock @noble/secp256k1 模块（解决 ESM 模块解析问题）
// 这是方案 C：使用 Mock 彻底解决 ESM 模块问题
jest.mock('@noble/secp256k1', () => {
  // 创建一个简单的 Mock 实现
  // 注意：这个 Mock 返回 CommonJS 兼容的对象，不涉及 ESM 转换
  
  // Mock Signature 类
  class MockSignature {
    private r: Uint8Array;
    private s: Uint8Array;

    constructor(r: Uint8Array, s: Uint8Array) {
      this.r = r;
      this.s = s;
    }

    toCompactRawBytes(): Uint8Array {
      // 返回 r || s（64 字节）
      const result = new Uint8Array(64);
      result.set(this.r, 0);
      result.set(this.s, 32);
      return result;
    }
  }

  // Mock Point 类
  class MockPoint {
    private x: Uint8Array;
    private y: Uint8Array;

    constructor(x: Uint8Array, y: Uint8Array) {
      this.x = x;
      this.y = y;
    }

    static fromHex(hex: string): MockPoint {
      // 简单的实现：从 hex 字符串创建 Point
      // 实际实现会更复杂，但 Mock 只需要满足接口
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
      }
      // 假设前32字节是x，后32字节是y
      const x = bytes.slice(0, 32);
      const y = bytes.slice(32, 64);
      return new MockPoint(x, y);
    }

    toRawBytes(compressed: boolean): Uint8Array {
      if (compressed) {
        // 压缩格式：33 字节（0x02 或 0x03 + x坐标）
        const result = new Uint8Array(33);
        result[0] = this.y[this.y.length - 1] % 2 === 0 ? 0x02 : 0x03;
        result.set(this.x, 1);
        return result;
      } else {
        // 未压缩格式：65 字节（0x04 + x + y）
        const result = new Uint8Array(65);
        result[0] = 0x04;
        result.set(this.x, 1);
        result.set(this.y, 33);
        return result;
      }
    }
  }

  return {
    // 工具函数
    utils: {
      randomPrivateKey: jest.fn(() => {
        // 返回 32 字节随机私钥
        const key = new Uint8Array(32);
        // 使用 crypto.randomBytes 生成随机数
        if (typeof require !== 'undefined') {
          const crypto = require('crypto');
          const randomBytes = crypto.randomBytes(32);
          key.set(randomBytes);
        } else {
          // 浏览器环境：使用 Web Crypto API
          crypto.getRandomValues(key);
        }
        return key;
      }),
      isValidPrivateKey: jest.fn((key: Uint8Array) => {
        // 验证私钥：应该是 32 字节，且不为全 0
        if (key.length !== 32) return false;
        // 检查是否全为 0
        return !key.every(byte => byte === 0);
      }),
    },
    
    // 主要函数
    getPublicKey: jest.fn((privateKey: Uint8Array, compressed: boolean) => {
      // 从私钥生成公钥（简化实现）
      // 实际实现会进行椭圆曲线计算，Mock 只需要返回正确格式
      if (compressed) {
        // 压缩格式：33 字节
        const publicKey = new Uint8Array(33);
        publicKey[0] = 0x02; // 压缩标记
        // 使用私钥的前32字节作为 x 坐标（简化）
        publicKey.set(privateKey.slice(0, 32), 1);
        return publicKey;
      } else {
        // 未压缩格式：65 字节
        const publicKey = new Uint8Array(65);
        publicKey[0] = 0x04; // 未压缩标记
        // 使用私钥生成 x 和 y 坐标（简化）
        publicKey.set(privateKey.slice(0, 32), 1);
        publicKey.set(privateKey.slice(0, 32), 33); // 简化：y = x
        return publicKey;
      }
    }),
    
    sign: jest.fn((hash: Uint8Array, privateKey: Uint8Array) => {
      // 签名实现（简化）
      // 实际实现会进行 ECDSA 签名，Mock 只需要返回正确格式的 Signature 对象
      // 使用 hash 和 privateKey 的前32字节生成 r 和 s
      const r = hash.slice(0, 32);
      const s = new Uint8Array(32);
      // 使用 privateKey 的前32字节作为 s（简化）
      s.set(privateKey.slice(0, 32));
      return new MockSignature(r, s);
    }),
    
    signAsync: jest.fn(async (hash: Uint8Array, privateKey: Uint8Array) => {
      // 异步签名（与 sign 相同，但返回 Promise）
      return Promise.resolve({
        r: hash.slice(0, 32),
        s: privateKey.slice(0, 32),
        toCompactRawBytes: () => {
          const result = new Uint8Array(64);
          result.set(hash.slice(0, 32), 0);
          result.set(privateKey.slice(0, 32), 32);
          return result;
        },
      });
    }),
    
    verify: jest.fn((_signature: Uint8Array, _hash: Uint8Array, _publicKey: Uint8Array) => {
      // 验证签名（简化实现）
      // 实际实现会进行 ECDSA 验证，Mock 可以返回 true 或根据测试需要返回 false
      return true;
    }),
    
    // Point 类（用于公钥压缩）
    Point: MockPoint,
    ProjectivePoint: MockPoint, // 别名
    
    // 其他可能需要的导出
    CURVE: {
      p: BigInt('0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f'),
      n: BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'),
    },
    
    Signature: MockSignature,
    
    etc: {},
  };
});

// Mock 全局变量（如果需要）
(global as any).console = {
  ...console,
  // 在测试中静默某些日志
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

