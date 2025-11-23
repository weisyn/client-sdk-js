/**
 * Permission 服务实现
 * 
 * **架构说明**：
 * - Permission Service 提供资源权限管理功能，包括所有权转移、协作者管理、委托授权和时间/高度锁
 * - 基于现有的 tx_builder 实现，提供完整的服务层封装
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex } from '../../utils/hex';
import {
  computeSignatureHashFromDraft,
  finalizeTransactionFromDraft,
} from '../../utils/tx_utils';
import {
  buildTransferOwnershipTx,
  buildUpdateCollaboratorsTx,
  buildGrantDelegationTx,
  buildSetLockTx,
} from './tx_builder';
import {
  TransferOwnershipIntent,
  UpdateCollaboratorsIntent,
  GrantDelegationIntent,
  SetTimeOrHeightLockIntent,
} from './types';

/**
 * TransactionResult 交易结果
 */
export interface TransactionResult {
  txHash: string;
  success: boolean;
}

/**
 * PermissionService 权限管理服务
 */
export class PermissionService {
  constructor(
    private client: IClient,
    private wallet?: Wallet
  ) {}

  /**
   * 获取 Wallet（优先使用参数，其次使用默认 Wallet）
   */
  private getWallet(wallet?: Wallet): Wallet {
    if (wallet) {
      return wallet;
    }
    if (this.wallet) {
      return this.wallet;
    }
    throw new Error('Wallet is required');
  }

  /**
   * 签名并提交交易（通用流程）
   * 
   * **流程**：
   * 1. 调用 wes_computeSignatureHashFromDraft 获取签名哈希
   * 2. 使用 Wallet 签名哈希
   * 3. 获取压缩公钥
   * 4. 调用 wes_finalizeTransactionFromDraft 完成交易
   * 5. 调用 wes_sendRawTransaction 提交已签名交易
   */
  private async signAndSubmitTransaction(
    unsignedTx: { draft: any; inputIndex: number },
    wallet: Wallet
  ): Promise<TransactionResult> {
    const { draft, inputIndex } = unsignedTx;

    // 1. 计算签名哈希
    const { hash, unsignedTx: unsignedTxHex } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 2. 使用 Wallet 签名哈希
    const signature = wallet.signHash(hash);

    // 3. 获取压缩公钥
    const publicKey = wallet.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      // 未压缩公钥，需要压缩
      if (typeof require !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Point } = require('@noble/secp256k1');
        const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
        pubkeyCompressed = point.toRawBytes(true);
      } else {
        // ES module 环境
        const { Point } = await import('@noble/secp256k1');
        const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
        pubkeyCompressed = point.toRawBytes(true);
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 4. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx: unsignedTxHex,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 5. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    return {
      txHash: sendResult.txHash,
      success: true,
    };
  }

  /**
   * 转移所有权
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 获取 Wallet
   * 3. 构建未签名交易
   * 4. 签名并提交交易
   */
  async transferOwnership(
    intent: TransferOwnershipIntent,
    wallet?: Wallet
  ): Promise<TransactionResult> {
    // 1. 参数验证
    if (!intent.resourceId || !intent.newOwnerAddress) {
      throw new Error('resourceId and newOwnerAddress are required');
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 构建未签名交易
    const unsignedTx = await buildTransferOwnershipTx(this.client, intent);

    // 4. 签名并提交交易
    return await this.signAndSubmitTransaction(unsignedTx, w);
  }

  /**
   * 更新协作者
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 获取 Wallet
   * 3. 构建未签名交易
   * 4. 签名并提交交易
   */
  async updateCollaborators(
    intent: UpdateCollaboratorsIntent,
    wallet?: Wallet
  ): Promise<TransactionResult> {
    // 1. 参数验证
    if (!intent.resourceId) {
      throw new Error('resourceId is required');
    }
    if (!intent.collaborators || intent.collaborators.length === 0) {
      throw new Error('at least one collaborator is required');
    }
    if (intent.requiredSignatures <= 0 || intent.requiredSignatures > intent.collaborators.length) {
      throw new Error('requiredSignatures must be between 1 and the number of collaborators');
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 构建未签名交易
    const unsignedTx = await buildUpdateCollaboratorsTx(this.client, intent);

    // 4. 签名并提交交易
    return await this.signAndSubmitTransaction(unsignedTx, w);
  }

  /**
   * 授予委托授权
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 获取 Wallet
   * 3. 构建未签名交易
   * 4. 签名并提交交易
   */
  async grantDelegation(
    intent: GrantDelegationIntent,
    wallet?: Wallet
  ): Promise<TransactionResult> {
    // 1. 参数验证
    if (!intent.resourceId || !intent.delegateAddress) {
      throw new Error('resourceId and delegateAddress are required');
    }
    if (!intent.operations || intent.operations.length === 0) {
      throw new Error('at least one operation is required');
    }
    if (intent.expiryBlocks <= 0) {
      throw new Error('expiryBlocks must be greater than 0');
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 构建未签名交易
    const unsignedTx = await buildGrantDelegationTx(this.client, intent);

    // 4. 签名并提交交易
    return await this.signAndSubmitTransaction(unsignedTx, w);
  }

  /**
   * 设置时间/高度锁
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 获取 Wallet
   * 3. 构建未签名交易
   * 4. 签名并提交交易
   */
  async setTimeOrHeightLock(
    intent: SetTimeOrHeightLockIntent,
    wallet?: Wallet
  ): Promise<TransactionResult> {
    // 1. 参数验证
    if (!intent.resourceId) {
      throw new Error('resourceId is required');
    }
    if (!intent.unlockTimestamp && !intent.unlockHeight) {
      throw new Error('either unlockTimestamp or unlockHeight must be provided');
    }
    if (intent.unlockTimestamp && intent.unlockTimestamp <= 0) {
      throw new Error('unlockTimestamp must be greater than 0');
    }
    if (intent.unlockHeight && intent.unlockHeight <= 0) {
      throw new Error('unlockHeight must be greater than 0');
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 构建未签名交易
    const unsignedTx = await buildSetLockTx(this.client, intent);

    // 4. 签名并提交交易
    return await this.signAndSubmitTransaction(unsignedTx, w);
  }
}

