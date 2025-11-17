/**
 * 地址工具函数
 */

// 注意：crypto 模块在运行时动态 require，避免浏览器环境报错

/**
 * Base58 字符表
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 编码
 */
function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  
  let num = BigInt(0);
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte);
  }
  
  let result = '';
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result;
    num = num / BigInt(58);
  }
  
  // 处理前导零
  for (const byte of bytes) {
    if (byte === 0) {
      result = BASE58_ALPHABET[0] + result;
    } else {
      break;
    }
  }
  
  return result;
}

/**
 * Base58 解码
 */
function base58Decode(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);
  
  let num = BigInt(0);
  for (const char of str) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: ${char}`);
    }
    num = num * BigInt(58) + BigInt(index);
  }
  
  // 计算前导零
  let leadingZeros = 0;
  for (const char of str) {
    if (char === BASE58_ALPHABET[0]) {
      leadingZeros++;
    } else {
      break;
    }
  }
  
  // 转换为字节数组
  const bytes: number[] = [];
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)));
    num = num / BigInt(256);
  }
  
  // 添加前导零
  for (let i = 0; i < leadingZeros; i++) {
    bytes.unshift(0);
  }
  
  return new Uint8Array(bytes);
}

/**
 * 计算 SHA256 哈希（同步版本）
 * 
 * **注意**：在浏览器环境中，此函数会抛出错误，因为 Web Crypto API 是异步的。
 * 如果需要浏览器支持，请使用 `sha256Async` 函数。
 */
function sha256(data: Uint8Array): Uint8Array {
  // Node.js 环境
  if (typeof require !== 'undefined') {
    try {
      const crypto = require('crypto');
      return new Uint8Array(crypto.createHash('sha256').update(data).digest());
    } catch (e) {
      // 如果 require 失败，继续尝试浏览器环境
    }
  }
  
  // 浏览器环境不支持同步 SHA256
  // 注意：Web Crypto API 的 digest 是异步的，但这里为了保持接口一致性，
  // 在浏览器环境中抛出错误，提示使用异步版本或 Node.js 环境
  throw new Error(
    'SHA256 requires Node.js crypto module. ' +
    'For browser environments, please use sha256Async or ensure you are running in Node.js.'
  );
}

/**
 * 计算 SHA256 哈希（异步版本，支持浏览器）
 */
async function sha256Async(data: Uint8Array): Promise<Uint8Array> {
  // 浏览器环境：使用 Web Crypto API
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hashBuffer);
  }
  
  // Node.js 环境：使用 crypto 模块
  if (typeof require !== 'undefined') {
    const crypto = require('crypto');
    return new Uint8Array(crypto.createHash('sha256').update(data).digest());
  }
  
  throw new Error('SHA256 is not supported in this environment');
}

/**
 * 双重 SHA256（同步版本）
 */
function doubleSha256(data: Uint8Array): Uint8Array {
  const hash1 = sha256(data);
  return sha256(hash1);
}

/**
 * 双重 SHA256（异步版本，支持浏览器）
 */
async function doubleSha256Async(data: Uint8Array): Promise<Uint8Array> {
  const hash1 = await sha256Async(data);
  return sha256Async(hash1);
}

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

/**
 * 将 20 字节地址转换为 Base58Check 编码
 * 
 * **格式**：
 * - 版本字节（1字节）+ 地址哈希（20字节）+ 校验和（4字节）
 * - 使用 Base58Check 编码
 * 
 * **注意**：
 * - WES 地址版本字节 = 0x1C
 */
export function addressBytesToBase58(addressBytes: Uint8Array): string {
  if (addressBytes.length !== 20) {
    throw new Error(`Invalid address length: expected 20 bytes, got ${addressBytes.length}`);
  }

  // WES 地址版本字节
  const versionByte = 0x1C;

  // 构建版本字节 + 地址哈希
  const versionedAddress = new Uint8Array(21);
  versionedAddress[0] = versionByte;
  versionedAddress.set(addressBytes, 1);

  // 计算校验和（双重 SHA256，取前4字节）
  // 注意：在浏览器环境中，如果 sha256 失败，会抛出错误
  // 建议在浏览器环境中使用异步版本的地址转换函数
  const hash1 = sha256(versionedAddress);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);

  // 构建完整地址：版本字节 + 地址哈希 + 校验和
  const fullAddress = new Uint8Array(25);
  fullAddress.set(versionedAddress, 0);
  fullAddress.set(checksum, 21);

  // Base58 编码
  return base58Encode(fullAddress);
}

/**
 * 将 Base58Check 编码地址转换为 20 字节地址哈希
 * 
 * **格式**：
 * - Base58Check 解码后：版本字节（1字节）+ 地址哈希（20字节）+ 校验和（4字节）
 * - 返回地址哈希（20字节）
 */
export function addressBase58ToBytes(base58Addr: string): Uint8Array {
  // Base58 解码
  const decoded = base58Decode(base58Addr);

  // 验证长度：版本字节（1）+ 地址哈希（20）+ 校验和（4）= 25 字节
  if (decoded.length !== 25) {
    throw new Error(`Invalid address length: expected 25 bytes after Base58 decode, got ${decoded.length}`);
  }

  // 验证校验和
  const versionedAddress = decoded.slice(0, 21); // 版本字节 + 地址哈希
  const checksum = decoded.slice(21); // 校验和

  const hash1 = sha256(versionedAddress);
  const hash2 = sha256(hash1);
  const expectedChecksum = hash2.slice(0, 4);

  // 比较校验和
  if (!equalBytes(checksum, expectedChecksum)) {
    throw new Error('Invalid checksum');
  }

  // 返回地址哈希（跳过版本字节）
  return decoded.slice(1, 21);
}

/**
 * 比较两个字节数组是否相等
 */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/**
 * 将十六进制地址字符串转换为 Base58Check 编码
 */
export function addressHexToBase58(hexAddr: string): string {
  // 移除 0x 前缀
  const cleanHex = hexAddr.startsWith('0x') ? hexAddr.slice(2) : hexAddr;

  // 解码十六进制
  const addressBytes = hexToAddress(cleanHex);

  return addressBytesToBase58(addressBytes);
}

/**
 * 将 Base58Check 编码地址转换为十六进制字符串
 */
export function addressBase58ToHex(base58Addr: string): string {
  const addressBytes = addressBase58ToBytes(base58Addr);
  return addressToHex(addressBytes);
}

/**
 * 将 20 字节地址转换为 Base58Check 编码（异步版本，支持浏览器）
 * 
 * **格式**：
 * - 版本字节（1字节）+ 地址哈希（20字节）+ 校验和（4字节）
 * - 使用 Base58Check 编码
 * 
 * **注意**：
 * - WES 地址版本字节 = 0x1C
 * - 此版本使用异步 SHA256，支持浏览器环境
 */
export async function addressBytesToBase58Async(addressBytes: Uint8Array): Promise<string> {
  if (addressBytes.length !== 20) {
    throw new Error(`Invalid address length: expected 20 bytes, got ${addressBytes.length}`);
  }

  // WES 地址版本字节
  const versionByte = 0x1C;

  // 构建版本字节 + 地址哈希
  const versionedAddress = new Uint8Array(21);
  versionedAddress[0] = versionByte;
  versionedAddress.set(addressBytes, 1);

  // 计算校验和（双重 SHA256，取前4字节）- 使用异步版本
  const hash1 = await sha256Async(versionedAddress);
  const hash2 = await sha256Async(hash1);
  const checksum = hash2.slice(0, 4);

  // 构建完整地址：版本字节 + 地址哈希 + 校验和
  const fullAddress = new Uint8Array(25);
  fullAddress.set(versionedAddress, 0);
  fullAddress.set(checksum, 21);

  // Base58 编码
  return base58Encode(fullAddress);
}

/**
 * 将 Base58Check 编码地址转换为 20 字节地址哈希（异步版本，支持浏览器）
 * 
 * **格式**：
 * - Base58Check 解码后：版本字节（1字节）+ 地址哈希（20字节）+ 校验和（4字节）
 * - 返回地址哈希（20字节）
 */
export async function addressBase58ToBytesAsync(base58Addr: string): Promise<Uint8Array> {
  // Base58 解码
  const decoded = base58Decode(base58Addr);

  // 验证长度：版本字节（1）+ 地址哈希（20）+ 校验和（4）= 25 字节
  if (decoded.length !== 25) {
    throw new Error(`Invalid address length: expected 25 bytes after Base58 decode, got ${decoded.length}`);
  }

  // 验证校验和
  const versionedAddress = decoded.slice(0, 21); // 版本字节 + 地址哈希
  const checksum = decoded.slice(21); // 校验和

  const hash1 = await sha256Async(versionedAddress);
  const hash2 = await sha256Async(hash1);
  const expectedChecksum = hash2.slice(0, 4);

  // 比较校验和
  if (!equalBytes(checksum, expectedChecksum)) {
    throw new Error('Invalid checksum');
  }

  // 返回地址哈希（跳过版本字节）
  return decoded.slice(1, 21);
}

/**
 * 将十六进制地址字符串转换为 Base58Check 编码（异步版本，支持浏览器）
 */
export async function addressHexToBase58Async(hexAddr: string): Promise<string> {
  // 移除 0x 前缀
  const cleanHex = hexAddr.startsWith('0x') ? hexAddr.slice(2) : hexAddr;

  // 解码十六进制
  const addressBytes = hexToAddress(cleanHex);

  return addressBytesToBase58Async(addressBytes);
}

/**
 * 将 Base58Check 编码地址转换为十六进制字符串（异步版本，支持浏览器）
 */
export async function addressBase58ToHexAsync(base58Addr: string): Promise<string> {
  const addressBytes = await addressBase58ToBytesAsync(base58Addr);
  return addressToHex(addressBytes);
}

