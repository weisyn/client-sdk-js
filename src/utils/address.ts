/**
 * 地址工具函数
 */

/**
 * 将地址转换为十六进制字符串
 */
export function addressToHex(address: Uint8Array): string {
  return '0x' + Array.from(address)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 将十六进制字符串转换为地址
 */
export function hexToAddress(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * 验证地址格式
 */
export function isValidAddress(address: Uint8Array | string): boolean {
  if (typeof address === 'string') {
    const cleanHex = address.startsWith('0x') ? address.slice(2) : address;
    return cleanHex.length === 40 && /^[0-9a-fA-F]+$/.test(cleanHex);
  }
  return address.length === 20;
}

