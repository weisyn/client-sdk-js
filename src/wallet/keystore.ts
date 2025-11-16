/**
 * Keystore 管理器
 * 
 * **架构说明**：
 * - Keystore 提供加密存储和恢复钱包功能
 * - 使用 PBKDF2 派生密钥，AES-256-GCM 加密
 * - 兼容以太坊 Keystore 格式（v3）
 */

import { Wallet } from './wallet';
import { KeystoreData } from './types';
import { bytesToHex, hexToBytes } from '../utils/hex';

/**
 * Keystore 类
 */
export class Keystore {
  /**
   * 从钱包创建 Keystore
   * 
   * **流程**：
   * 1. 使用密码派生加密密钥（PBKDF2）
   * 2. 使用 AES-256-GCM 加密私钥
   * 3. 生成 Keystore 数据
   */
  static async create(wallet: Wallet, password: string): Promise<KeystoreData> {
    // 1. 生成随机盐值
    const salt = Keystore.generateSalt();

    // 2. 使用 PBKDF2 派生加密密钥
    const derivedKey = await Keystore.deriveKey(password, salt);

    // 3. 生成随机 IV
    const iv = Keystore.generateIV();

    // 4. 加密私钥
    const privateKeyHex = wallet.exportPrivateKey();
    const privateKeyBytes = hexToBytes(privateKeyHex);
    const encrypted = await Keystore.encrypt(privateKeyBytes, derivedKey, iv);

    // 5. 计算 MAC（消息认证码）
    const mac = await Keystore.computeMAC(derivedKey, encrypted.ciphertext);

    // 6. 构建 Keystore 数据
    return {
      version: 3,
      crypto: {
        kdf: 'pbkdf2',
        kdfparams: {
          c: 262144, // PBKDF2 迭代次数
          dklen: 32, // 派生密钥长度
          prf: 'hmac-sha256',
          salt: bytesToHex(salt),
        },
        cipher: 'aes-256-gcm',
        ciphertext: bytesToHex(encrypted.ciphertext),
        iv: bytesToHex(iv),
        mac: bytesToHex(mac),
      },
      address: wallet.getAddressHex(),
    };
  }

  /**
   * 从 Keystore 恢复钱包
   * 
   * **流程**：
   * 1. 使用密码派生加密密钥（PBKDF2）
   * 2. 验证 MAC
   * 3. 使用 AES-256-GCM 解密私钥
   * 4. 从私钥创建钱包
   */
  static async recover(keystore: KeystoreData, password: string): Promise<Wallet> {
    // 1. 验证版本
    if (keystore.version !== 3) {
      throw new Error(`Unsupported keystore version: ${keystore.version}`);
    }

    // 2. 提取加密参数
    const { crypto } = keystore;
    if (crypto.kdf !== 'pbkdf2') {
      throw new Error(`Unsupported KDF: ${crypto.kdf}`);
    }
    if (crypto.cipher !== 'aes-256-gcm') {
      throw new Error(`Unsupported cipher: ${crypto.cipher}`);
    }

    const kdfparams = crypto.kdfparams as any;
    const salt = hexToBytes(kdfparams.salt);
    const iv = hexToBytes(crypto.iv);
    const ciphertext = hexToBytes(crypto.ciphertext);
    const mac = hexToBytes(crypto.mac);

    // 3. 派生加密密钥
    const derivedKey = await Keystore.deriveKey(password, salt, kdfparams.c);

    // 4. 验证 MAC
    const computedMAC = await Keystore.computeMAC(derivedKey, ciphertext);
    if (!Keystore.compareBytes(mac, computedMAC)) {
      throw new Error('Invalid password: MAC verification failed');
    }

    // 5. 解密私钥
    const privateKeyBytes = await Keystore.decrypt(ciphertext, derivedKey, iv);

    // 6. 从私钥创建钱包
    const privateKeyHex = bytesToHex(privateKeyBytes);
    return Wallet.fromPrivateKey(privateKeyHex);
  }

  /**
   * 验证密码
   */
  static async verifyPassword(keystore: KeystoreData, password: string): Promise<boolean> {
    try {
      await Keystore.recover(keystore, password);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成随机盐值（32 字节）
   */
  private static generateSalt(): Uint8Array {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);
      return salt;
    }
    
    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      return new Uint8Array(crypto.randomBytes(32));
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 生成随机 IV（12 字节，用于 AES-GCM）
   */
  private static generateIV(): Uint8Array {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      return iv;
    }
    
    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      return new Uint8Array(crypto.randomBytes(12));
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 使用 PBKDF2 派生密钥
   */
  private static async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = 262144
  ): Promise<CryptoKey> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用 Web Crypto API
      const passwordKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );

      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations,
          hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    if (typeof require !== 'undefined') {
      // Node.js 环境：使用 crypto 模块
      const crypto = require('crypto');
      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha256');
      
      // 转换为 CryptoKey（简化实现）
      // 注意：Node.js 的 crypto 模块不直接支持 CryptoKey，这里需要适配
      // TODO: 使用 node-webcrypto-ossl 或其他库来统一接口
      throw new Error('Node.js PBKDF2 implementation requires additional library');
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 加密数据（AES-256-GCM）
   */
  private static async encrypt(
    data: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
          tagLength: 128, // 128-bit authentication tag
        },
        key,
        data
      );

      const encryptedArray = new Uint8Array(encrypted);
      // GCM 模式：密文 + 认证标签
      const tagLength = 16; // 128 bits = 16 bytes
      const ciphertext = encryptedArray.slice(0, -tagLength);
      const tag = encryptedArray.slice(-tagLength);

      return { ciphertext, tag };
    }

    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from([])); // 无附加认证数据
      
      let ciphertext = cipher.update(data);
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        ciphertext: new Uint8Array(ciphertext),
        tag: new Uint8Array(tag),
      };
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 解密数据（AES-256-GCM）
   */
  private static async decrypt(
    ciphertext: Uint8Array,
    key: CryptoKey,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    // TODO: 实现解密逻辑
    // 注意：需要从 Keystore 中提取认证标签
    throw new Error('Decrypt not fully implemented');
  }

  /**
   * 计算 MAC（消息认证码）
   */
  private static async computeMAC(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    // 使用 HMAC-SHA256 计算 MAC
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const hmacKey = await crypto.subtle.importKey(
        'raw',
        await crypto.subtle.exportKey('raw', key),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', hmacKey, data);
      return new Uint8Array(signature).slice(0, 32); // 取前 32 字节
    }

    if (typeof require !== 'undefined') {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', await crypto.subtle.exportKey('raw', key));
      hmac.update(data);
      return new Uint8Array(hmac.digest());
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 比较两个字节数组是否相等
   */
  private static compareBytes(a: Uint8Array, b: Uint8Array): boolean {
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
}
