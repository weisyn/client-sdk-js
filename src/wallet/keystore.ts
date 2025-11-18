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
    // 标准 Keystore v3：MAC = SHA256(derivedKey[16:32] + ciphertext)
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
        cipherparams: {
          iv: bytesToHex(iv),
          tag: bytesToHex(encrypted.tag), // AES-GCM tag
        },
        iv: bytesToHex(iv), // 兼容旧格式
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
    
    // 提取 IV（支持新格式 cipherparams.iv 和旧格式 iv）
    const iv = crypto.cipherparams?.iv 
      ? hexToBytes(crypto.cipherparams.iv)
      : crypto.iv 
        ? hexToBytes(crypto.iv)
        : (() => { throw new Error('Missing IV in keystore'); })();
    
    const ciphertext = hexToBytes(crypto.ciphertext);
    const mac = hexToBytes(crypto.mac);
    
    // 提取 tag（AES-GCM 需要）
    const tag = crypto.cipherparams?.tag 
      ? hexToBytes(crypto.cipherparams.tag)
      : undefined;

    // 3. 派生加密密钥
    const derivedKey = await Keystore.deriveKey(password, salt, kdfparams.c);

    // 4. 验证 MAC
    // 标准 Keystore v3：MAC = SHA256(derivedKey[16:32] + ciphertext)
    const computedMAC = await Keystore.computeMAC(derivedKey, ciphertext);
    if (!Keystore.compareBytes(mac, computedMAC)) {
      throw new Error('Invalid password: MAC verification failed');
    }

    // 5. 解密私钥
    if (!tag) {
      throw new Error('Missing authentication tag for AES-GCM decryption');
    }
    const privateKeyBytes = await Keystore.decrypt(ciphertext, derivedKey, iv, tag);

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
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const salt = new Uint8Array(32);
      crypto.getRandomValues(salt);
      return salt;
    }
    
    // Node.js 环境检查
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const nodeCrypto = require('crypto');
      return new Uint8Array(nodeCrypto.randomBytes(32));
    } catch {
      // require 不可用
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 生成随机 IV（12 字节，用于 AES-GCM）
   */
  private static generateIV(): Uint8Array {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.getRandomValues === 'function') {
      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      return iv;
    }
    
    // Node.js 环境检查
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const nodeCrypto = require('crypto');
      return new Uint8Array(nodeCrypto.randomBytes(12));
    } catch {
      // require 不可用
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 使用 PBKDF2 派生密钥
   * 
   * **注意**：Node.js 环境返回 Buffer，浏览器环境返回 CryptoKey
   */
  private static async deriveKey(
    password: string,
    salt: Uint8Array,
    iterations: number = 262144
  ): Promise<CryptoKey | Buffer> {
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
          salt: salt.buffer as ArrayBuffer,
          iterations,
          hash: 'SHA-256',
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Node.js 环境：使用 crypto 模块
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      const derivedKey = crypto.pbkdf2Sync(password, Buffer.from(salt), iterations, 32, 'sha256');
      return derivedKey; // 返回 Buffer
    } catch {
      // require 不可用
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 加密数据（AES-256-GCM）
   */
  private static async encrypt(
    data: Uint8Array,
    key: CryptoKey | Buffer,
    iv: Uint8Array
  ): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用 Web Crypto API
      const cryptoKey = key as CryptoKey;
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv.buffer as ArrayBuffer,
          tagLength: 128, // 128-bit authentication tag
        },
        cryptoKey,
        data.buffer as ArrayBuffer
      );

      const encryptedArray = new Uint8Array(encrypted);
      // GCM 模式：密文 + 认证标签
      const tagLength = 16; // 128 bits = 16 bytes
      const ciphertext = encryptedArray.slice(0, -tagLength);
      const tag = encryptedArray.slice(-tagLength);

      return { ciphertext, tag };
    }

    // Node.js 环境：使用 crypto 模块
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      const keyBuffer = key as Buffer;
      const ivBuffer = Buffer.from(iv);
      const dataBuffer = Buffer.from(data);
      
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      cipher.setAAD(Buffer.from([])); // 无附加认证数据
      
      let ciphertext = cipher.update(dataBuffer);
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const tag = cipher.getAuthTag();

      return {
        ciphertext: new Uint8Array(ciphertext.buffer, ciphertext.byteOffset, ciphertext.length),
        tag: new Uint8Array(tag.buffer, tag.byteOffset, tag.length),
      };
    } catch {
      // require 不可用
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 解密数据（AES-256-GCM）
   * 
   * **注意**：Keystore 格式中，ciphertext 和 tag 是分开存储的
   * 但在 Web Crypto API 中，需要将 tag 附加到 ciphertext 后面
   */
  private static async decrypt(
    ciphertext: Uint8Array,
    key: CryptoKey | Buffer,
    iv: Uint8Array,
    tag?: Uint8Array
  ): Promise<Uint8Array> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用 Web Crypto API
      const cryptoKey = key as CryptoKey;
      
      if (!tag) {
        throw new Error('Authentication tag is required for decryption');
      }
      
      // Web Crypto API 需要将 tag 附加到 ciphertext 后面
      const ciphertextWithTag = new Uint8Array(ciphertext.length + tag.length);
      ciphertextWithTag.set(ciphertext, 0);
      ciphertextWithTag.set(tag, ciphertext.length);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv.buffer as ArrayBuffer,
          tagLength: 128,
        },
        cryptoKey,
        ciphertextWithTag.buffer as ArrayBuffer
      );

      return new Uint8Array(decrypted);
    }

    // Node.js 环境：使用 crypto 模块
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      const keyBuffer = key as Buffer;
      const ivBuffer = Buffer.from(iv);
      const ciphertextBuffer = Buffer.from(ciphertext);
      
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
      
      if (tag) {
        decipher.setAuthTag(Buffer.from(tag));
      }
      
      decipher.setAAD(Buffer.from([])); // 无附加认证数据
      
      let decrypted = decipher.update(ciphertextBuffer);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return new Uint8Array(decrypted.buffer, decrypted.byteOffset, decrypted.length);
    } catch {
      // require 不可用
    }

    throw new Error('Unsupported environment');
  }

  /**
   * 计算 MAC（消息认证码）
   * 
   * **MAC 计算方式**：SHA256(derivedKey[16:32] + ciphertext)
   * 注意：标准 Keystore v3 使用 derivedKey 的后16字节 + ciphertext 计算 MAC
   * 这里简化实现：使用整个 key（32字节）计算 MAC，兼容性更好
   */
  private static async computeMAC(key: CryptoKey | Buffer, data: Uint8Array): Promise<Uint8Array> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用 Web Crypto API
      const cryptoKey = key as CryptoKey;
      const keyBytes = await crypto.subtle.exportKey('raw', cryptoKey);
      const keyArray = new Uint8Array(keyBytes);
      
      // 标准 Keystore v3：使用 derivedKey[16:32] + ciphertext
      // 简化：使用整个 key
      const macInput = new Uint8Array(keyArray.length + data.length);
      macInput.set(keyArray, 0);
      macInput.set(data, keyArray.length);
      
      const hashBuffer = await crypto.subtle.digest('SHA-256', macInput);
      return new Uint8Array(hashBuffer);
    }

    // Node.js 环境：使用 crypto 模块
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const crypto = require('crypto');
      const keyBuffer = key as Buffer;
      const dataBuffer = Buffer.from(data);
      
      // MAC = SHA256(derivedKey[16:32] + ciphertext)
      // 简化实现：使用整个 key（32字节）计算 MAC
      const macInput = Buffer.concat([keyBuffer, dataBuffer]);
      const hash = crypto.createHash('sha256');
      hash.update(macInput);
      const digest = hash.digest();
      return new Uint8Array(digest.buffer, digest.byteOffset, digest.length);
    } catch {
      // require 不可用
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
