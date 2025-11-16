/**
 * Wallet 类型定义
 */

/**
 * 钱包接口
 */
export interface IWallet {
  /** 地址（20 字节） */
  address: Uint8Array;
  /** 公钥 */
  publicKey: Uint8Array;
  /** 签名交易 */
  signTransaction(unsignedTx: Uint8Array): Promise<Uint8Array>;
  /** 签名消息 */
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

/**
 * Keystore 数据
 */
export interface KeystoreData {
  /** 版本 */
  version: number;
  /** 加密算法 */
  crypto: {
    /** 密码派生函数 */
    kdf: string;
    /** KDF 参数 */
    kdfparams: Record<string, any>;
    /** 加密算法 */
    cipher: string;
    /** 加密参数 */
  };
  /** 地址 */
  address: string;
}

