/**
 * ABI Helper 规范一致性测试
 * 
 * 验证 client-sdk-js 的 ABI helper 实现是否符合 WES ABI 规范
 * 规范来源：weisyn.git/docs/components/core/ispc/abi-and-payload.md
 */

import { buildPayload, buildAndEncodePayload, type BuildPayloadOptions, type ABIMethod } from '../../src/utils/abi';

describe('ABI Helper Conformance Tests', () => {
  // 测试用例基于 WES ABI 规范中的示例
  // 规范来源：docs/components/core/ispc/abi-and-payload.md

  describe('buildPayload - 保留字段验证', () => {
    it('应该正确构建包含 from 字段的 payload', () => {
      const options: BuildPayloadOptions = {
        includeFrom: true,
        from: new Uint8Array(20).fill(0x12),
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('from');
      expect(payload.from).toBe('0x' + '12'.repeat(20));
    });

    it('应该正确构建包含 to 字段的 payload', () => {
      const options: BuildPayloadOptions = {
        includeTo: true,
        to: new Uint8Array(20).fill(0xab),
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('to');
      expect(payload.to).toBe('0x' + 'ab'.repeat(20));
    });

    it('应该正确构建包含 amount 字段的 payload', () => {
      const options: BuildPayloadOptions = {
        includeAmount: true,
        amount: '1000000',
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('amount');
      expect(payload.amount).toBe('1000000');
    });

    it('应该正确构建包含 token_id 字段的 payload', () => {
      const options: BuildPayloadOptions = {
        includeTokenId: true,
        tokenId: new Uint8Array(32).fill(0x00),
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('token_id');
      expect(payload.token_id).toBe('0x' + '00'.repeat(32));
    });

    it('应该正确构建包含所有保留字段的 payload', () => {
      const options: BuildPayloadOptions = {
        includeFrom: true,
        from: new Uint8Array(20).fill(0x12),
        includeTo: true,
        to: new Uint8Array(20).fill(0xab),
        includeAmount: true,
        amount: '1000000',
        includeTokenId: true,
        tokenId: new Uint8Array(32).fill(0x00),
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('from');
      expect(payload).toHaveProperty('to');
      expect(payload).toHaveProperty('amount');
      expect(payload).toHaveProperty('token_id');
    });
  });

  describe('buildPayload - 扩展字段验证', () => {
    it('应该正确添加方法参数作为扩展字段', () => {
      const methodInfo: ABIMethod = {
        name: 'transfer',
        parameters: [
          { name: 'recipient', type: 'string', required: true }, // 使用 recipient 而不是 to，避免与保留字段冲突
          { name: 'value', type: 'u64', required: true }, // 使用 value 而不是 amount，避免与保留字段冲突
        ],
      };

      const args = ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', '1000'];

      const payload = buildPayload(methodInfo, args, {});

      expect(payload).toHaveProperty('recipient', args[0]);
      expect(payload).toHaveProperty('value', args[1]);
    });

    it('应该拒绝与保留字段冲突的参数名', () => {
      const methodInfo: ABIMethod = {
        name: 'invalid',
        parameters: [
          { name: 'from', type: 'string', required: true }, // 与保留字段冲突
        ],
      };

      expect(() => {
        buildPayload(methodInfo, ['0x1234'], {});
      }).toThrow(/conflicts with reserved field/);
    });

    it('应该在没有方法信息时添加参数到 payload', () => {
      const args = ['value1', 'value2'];

      const payload = buildPayload(null, args, {});

      // 根据当前实现，如果没有方法信息，参数会作为 args 数组添加
      expect(payload).toHaveProperty('args');
      expect(Array.isArray(payload.args)).toBe(true);
      expect(payload.args).toEqual(['value1', 'value2']);
    });
  });

  describe('buildAndEncodePayload - Base64 编码验证', () => {
    it('应该正确编码 payload 为 Base64', () => {
      const options: BuildPayloadOptions = {
        includeFrom: true,
        from: new Uint8Array(20).fill(0x12),
        includeAmount: true,
        amount: '1000000',
      };

      const encoded = buildAndEncodePayload(null, [], options);

      // Base64 编码应该是字符串
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      // 可以解码验证
      const decoded = atob(encoded);
      const payload = JSON.parse(decoded);

      expect(payload).toHaveProperty('from');
      expect(payload).toHaveProperty('amount');
    });

    it('应该与规范示例一致', () => {
      // 规范示例：
      // {
      //   "from": "0x1234567890123456789012345678901234567890",
      //   "to": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      //   "amount": "1000000",
      //   "token_id": "0x0000000000000000000000000000000000000000000000000000000000000000"
      // }

      const fromHex = '1234567890123456789012345678901234567890';
      const toHex = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';
      const tokenIdHex = '0000000000000000000000000000000000000000000000000000000000000000';

      const options: BuildPayloadOptions = {
        includeFrom: true,
        from: hexToBytes(fromHex),
        includeTo: true,
        to: hexToBytes(toHex),
        includeAmount: true,
        amount: '1000000',
        includeTokenId: true,
        tokenId: hexToBytes(tokenIdHex),
      };

      const encoded = buildAndEncodePayload(null, [], options);
      const decoded = atob(encoded);
      const payload = JSON.parse(decoded);

      expect(payload.from).toBe('0x' + fromHex);
      expect(payload.to).toBe('0x' + toHex);
      expect(payload.amount).toBe('1000000');
      expect(payload.token_id).toBe('0x' + tokenIdHex);
    });
  });

  describe('字段命名规范验证', () => {
    it('应该使用 token_id（下划线）而不是 tokenID（驼峰）', () => {
      const options: BuildPayloadOptions = {
        includeTokenId: true,
        tokenId: new Uint8Array(32).fill(0x00),
      };

      const payload = buildPayload(null, [], options);

      expect(payload).toHaveProperty('token_id');
      expect(payload).not.toHaveProperty('tokenID');
    });
  });
});

// 辅助函数：将十六进制字符串转换为 Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

