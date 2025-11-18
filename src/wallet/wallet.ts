/**
 * Wallet 实现
 * 
 * 提供密钥管理和交易签名功能
 * 
 * **架构说明**：
 * - Wallet 负责密钥管理和签名，不涉及业务逻辑
 * - 使用 secp256k1 曲线（与比特币/以太坊兼容）
 * - 支持浏览器和 Node.js 环境
 */

import { IWallet } from './types';
import { bytesToHex, hexToBytes } from '../utils/hex';
import { addressToHex } from '../utils/address';
import * as secp256k1 from '@noble/secp256k1';
import { keccak256 } from 'js-sha3';
// Note: js-sha3 exports keccak256 as a named export

/**
 * Wallet 类
 */
export class Wallet implements IWallet {
  public readonly address: Uint8Array;
  public readonly publicKey: Uint8Array;
  private privateKey: Uint8Array;

  private constructor(privateKey: Uint8Array, publicKey: Uint8Array, address: Uint8Array) {
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.address = address;
  }

  /**
   * 创建新钱包
   */
  static async create(): Promise<Wallet> {
    // 生成 32 字节随机私钥
    const privateKey = secp256k1.utils.randomPrivateKey();

    // 从私钥派生公钥和地址
    const publicKey = secp256k1.getPublicKey(privateKey, false); // false = 未压缩（65 字节）
    const address = Wallet.deriveAddress(publicKey);

    return new Wallet(privateKey, publicKey, address);
  }

  /**
   * 从私钥创建钱包
   */
  static async fromPrivateKey(privateKeyHex: string): Promise<Wallet> {
    // 移除 0x 前缀（如果有）
    const cleanHex = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
    
    const privateKeyBytes = hexToBytes(cleanHex);
    
    // 验证私钥长度（secp256k1 私钥应该是 32 字节）
    if (privateKeyBytes.length !== 32) {
      throw new Error(`Invalid private key length: expected 32 bytes, got ${privateKeyBytes.length}`);
    }

    // 验证私钥有效性
    if (!secp256k1.utils.isValidPrivateKey(privateKeyBytes)) {
      throw new Error('Invalid private key: key is out of range');
    }

    // 从私钥派生公钥和地址
    const publicKey = secp256k1.getPublicKey(privateKeyBytes, false); // false = 未压缩
    const address = Wallet.deriveAddress(publicKey);

    return new Wallet(privateKeyBytes, publicKey, address);
  }

  /**
   * 从公钥派生地址
   * 
   * **算法**：
   * 1. 对公钥进行 Keccak-256 哈希
   * 2. 取后 20 字节作为地址
   */
  private static deriveAddress(publicKey: Uint8Array): Uint8Array {
    // 如果公钥是未压缩格式（65 字节，包含 0x04 前缀），跳过第一个字节
    const keyBytes = publicKey.length === 65 ? publicKey.slice(1) : publicKey;
    
    // 计算 Keccak-256 哈希
    const hash = keccak256.arrayBuffer(keyBytes);
    const hashArray = new Uint8Array(hash);
    
    // 取后 20 字节作为地址
    return hashArray.slice(-20);
  }

  /**
   * 签名交易
   * 
   * **流程**：
   * 1. 计算交易哈希（SHA-256）
   * 2. 使用 ECDSA 签名哈希
   */
  async signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array> {
    // 计算交易哈希
    const hash = await this.hashMessage(unsignedTx);
    
    // 签名哈希
    return this.signHash(hash);
  }

  /**
   * 签名消息
   * 
   * **流程**：
   * 1. 计算消息哈希（SHA-256）
   * 2. 使用 ECDSA 签名哈希
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    // 计算消息哈希
    const hash = await this.hashMessage(message);
    
    // 签名哈希
    return this.signHash(hash);
  }

  /**
   * 签名哈希值
   * 
   * **签名格式**：
   * - 使用 secp256k1 签名
   * - 返回 64 字节签名（r || s，各 32 字节）
   */
  signHash(hash: Uint8Array): Uint8Array {
    // 使用 secp256k1 签名
    const signature = secp256k1.sign(hash, this.privateKey);
    
    // 返回紧凑格式签名（64 字节：r || s）
    return signature.toCompactRawBytes();
  }

  /**
   * 计算消息哈希（SHA-256）
   */
  private async hashMessage(message: Uint8Array): Promise<Uint8Array> {
    // 在浏览器环境使用 Web Crypto API
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 确保 message 是 ArrayBuffer，兼容 Web Crypto API
      let buffer: ArrayBuffer;
      if (message.buffer instanceof SharedArrayBuffer) {
        // SharedArrayBuffer 需要复制到新的 ArrayBuffer
        buffer = new ArrayBuffer(message.byteLength);
        new Uint8Array(buffer).set(new Uint8Array(message.buffer, message.byteOffset, message.byteLength));
      } else {
        buffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength);
      }
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return new Uint8Array(hashBuffer);
    }
    
    // Node.js 环境使用 crypto 模块
    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(message).digest();
      return new Uint8Array(hash);
    }

    throw new Error('Unsupported environment: neither browser nor Node.js');
  }

  /**
   * 导出私钥（谨慎使用）
   * 
   * **安全警告**：
   * - 私钥应该保密，不要在不安全的环境中导出
   * - 建议使用 Keystore 进行加密存储
   */
  exportPrivateKey(): string {
    return bytesToHex(this.privateKey);
  }

  /**
   * 获取地址的十六进制字符串
   */
  getAddressHex(): string {
    return addressToHex(this.address);
  }
}
