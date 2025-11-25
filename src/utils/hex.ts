/**
 * 十六进制工具函数
 */

/**
 * 将 Uint8Array 转换为十六进制字符串
 */
export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * 将十六进制字符串转换为 Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * 验证十六进制字符串格式
 */
export function isValidHex(hex: string): boolean {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  return /^[0-9a-fA-F]+$/.test(cleanHex);
}
