/**
 * Staking 服务实现
 * 
 * **架构说明**：
 * - Staking 业务语义在 SDK 层，通过调用合约方法实现
 * - 支持质押、解质押、委托、取消委托、领取奖励等功能
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex, hexToBytes } from '../../utils/hex';
import {
  computeSignatureHashFromDraft,
  finalizeTransactionFromDraft,
  findOutputsByOwner,
  sumAmountsByToken,
} from '../../utils/tx_utils';
import { buildStakeDraft, buildUnstakeDraft, buildDelegateDraft, buildUndelegateDraft, buildClaimRewardDraft } from './tx_builder';
import {
  StakeRequest,
  StakeResult,
  UnstakeRequest,
  UnstakeResult,
  DelegateRequest,
  DelegateResult,
  UndelegateRequest,
  UndelegateResult,
  ClaimRewardRequest,
  ClaimRewardResult,
  SlashRequest,
  SlashResult,
} from './types';

/**
 * Staking 服务
 */
export class StakingService {
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
   * 质押代币
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 StakeID
   */
  async stake(request: StakeRequest, wallet?: Wallet): Promise<StakeResult> {
    // 1. 参数验证
    this.validateStakeRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    const lockBlocks = request.lockBlocks
      ? typeof request.lockBlocks === 'bigint'
        ? request.lockBlocks
        : BigInt(request.lockBlocks)
      : BigInt(0);

    if (lockBlocks === BigInt(0)) {
      throw new Error('lockBlocks must be greater than 0');
    }

    const { draft, inputIndex } = await buildStakeDraft(
      this.client,
      request.from,
      request.validatorAddr,
      amount,
      lockBlocks
      // TODO: 支持 stakingContractAddr 参数
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error('require is not available. Please use ES module import for @noble/secp256k1');
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取 StakeID
    let stakeID = '';
    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找质押输出（通常是第一个资产输出，且 owner 是验证者地址）
        // 质押输出通常带有 HeightLock 或 ContractLock
        for (const output of outputs) {
          const outputType = output.type || output.Type;
          const outputOwner = output.owner || output.Owner;
          
          if (outputType === 'asset') {
            const ownerBytes = typeof outputOwner === 'string'
              ? hexToBytes(outputOwner.startsWith('0x') ? outputOwner.slice(2) : outputOwner)
              : new Uint8Array(outputOwner);
            
            if (this.addressesEqual(ownerBytes, request.validatorAddr)) {
              stakeID = output.outpoint || output.Outpoint || '';
              break;
            }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空字符串
    }

    return {
      stakeId: stakeID,
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证质押请求
   */
  private validateStakeRequest(request: StakeRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }
    if (request.validatorAddr.length !== 20) {
      throw new Error('Validator address must be 20 bytes');
    }

    // 2. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }

    // 3. 验证锁定期
    if (request.lockBlocks !== undefined) {
      const lockBlocks = typeof request.lockBlocks === 'bigint' ? request.lockBlocks : BigInt(request.lockBlocks);
      if (lockBlocks <= BigInt(0)) {
        throw new Error('Lock blocks must be greater than 0');
      }
    }
  }

  /**
   * 比较两个地址是否相等
   */
  private addressesEqual(a: Uint8Array, b: Uint8Array): boolean {
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
   * 解除质押
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取解质押金额和奖励金额
   */
  async unstake(request: UnstakeRequest, wallet?: Wallet): Promise<UnstakeResult> {
    // 1. 参数验证
    this.validateUnstakeRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    const { draft, inputIndex } = await buildUnstakeDraft(
      this.client,
      request.from,
      request.stakeId,
      amount
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error('require is not available. Please use ES module import for @noble/secp256k1');
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取解质押金额和奖励金额
    let unstakeAmount = amount;
    let rewardAmount = BigInt(0);

    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找返回给用户的输出（owner 是解质押者地址）
        const userOutputs = findOutputsByOwner(outputs, request.from);
        
        // 汇总原生币金额（解质押金额 + 奖励）
        let totalAmount = BigInt(0);
        for (const output of userOutputs) {
          const outputType = output.type || output.Type;
          if (outputType === 'asset') {
            const assetContent = output.asset_content || output.assetContent || {};
            const assetType = assetContent.asset_type || assetContent.assetType;
            if (assetType === 'native_coin' || !assetType) {
              const amountStr = assetContent.amount || output.amount || '0';
              totalAmount += BigInt(amountStr);
            }
          }
        }
        
        if (totalAmount > BigInt(0)) {
          unstakeAmount = totalAmount;
          // 奖励金额 = 总金额 - 请求的解质押金额（简化处理）
          if (unstakeAmount > amount) {
            rewardAmount = unstakeAmount - amount;
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    return {
      txHash: sendResult.txHash,
      unstakeAmount,
      rewardAmount,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证解质押请求
   */
  private validateUnstakeRequest(request: UnstakeRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证质押ID
    if (request.stakeId.length !== 32) {
      throw new Error('Stake ID must be 32 bytes');
    }
  }

  /**
   * 委托验证
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（使用 DelegationLock）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 DelegateID
   */
  async delegate(request: DelegateRequest, wallet?: Wallet): Promise<DelegateResult> {
    // 1. 参数验证
    this.validateDelegateRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    // 默认参数：有效期 0（永不过期），单次操作最大价值等于委托金额
    const { draft, inputIndex } = await buildDelegateDraft(
      this.client,
      request.from,
      request.validatorAddr,
      amount,
      BigInt(0), // expiryDurationBlocks: 0 = 永不过期
      amount // maxValuePerOperation: 等于委托金额
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error('require is not available. Please use ES module import for @noble/secp256k1');
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取 DelegateID
    let delegateID = '';
    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找委托输出（通常是第一个资产输出，且 owner 是验证者地址）
        // 委托输出通常带有 DelegationLock
        for (const output of outputs) {
          const outputType = output.type || output.Type;
          const outputOwner = output.owner || output.Owner;
          
          if (outputType === 'asset') {
            const ownerBytes = typeof outputOwner === 'string'
              ? hexToBytes(outputOwner.startsWith('0x') ? outputOwner.slice(2) : outputOwner)
              : new Uint8Array(outputOwner);
            
            if (this.addressesEqual(ownerBytes, request.validatorAddr)) {
              delegateID = output.outpoint || output.Outpoint || '';
              break;
            }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空字符串
    }

    return {
      delegateId: delegateID,
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证委托请求
   */
  private validateDelegateRequest(request: DelegateRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }
    if (request.validatorAddr.length !== 20) {
      throw new Error('Validator address must be 20 bytes');
    }

    // 2. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }
  }

  /**
   * 取消委托
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（消费委托 UTXO）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   */
  async undelegate(request: UndelegateRequest, wallet?: Wallet): Promise<UndelegateResult> {
    // 1. 参数验证
    this.validateUndelegateRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    const { draft, inputIndex } = await buildUndelegateDraft(
      this.client,
      request.from,
      request.delegateId,
      amount
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error('require is not available. Please use ES module import for @noble/secp256k1');
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证取消委托请求
   */
  private validateUndelegateRequest(request: UndelegateRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证委托ID
    if (request.delegateId.length === 0) {
      throw new Error('Delegate ID is required');
    }
  }

  /**
   * 领取奖励
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（消费奖励 UTXO）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取奖励金额
   */
  async claimReward(request: ClaimRewardRequest, wallet?: Wallet): Promise<ClaimRewardResult> {
    // 1. 参数验证
    this.validateClaimRewardRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const { draft, inputIndex } = await buildClaimRewardDraft(
      this.client,
      request.from,
      request.stakeId,
      request.delegateId
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      'SIGHASH_ALL'
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error('require is not available. Please use ES module import for @noble/secp256k1');
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: 'SIGHASH_ALL',
      pubkey: '0x' + bytesToHex(pubkeyCompressed),
      signature: '0x' + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取奖励金额
    let rewardAmount = BigInt(0);

    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找返回给用户的输出（owner 是领取者地址）
        const userOutputs = findOutputsByOwner(outputs, request.from);
        
        // 汇总原生币金额（奖励通常是原生币）
        const totalAmount = sumAmountsByToken(userOutputs, null);
        if (totalAmount !== null) {
          rewardAmount = totalAmount;
        }
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    return {
      txHash: sendResult.txHash,
      rewardAmount,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证领取奖励请求
   */
  private validateClaimRewardRequest(request: ClaimRewardRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证至少提供一个ID
    if ((!request.stakeId || request.stakeId.length === 0) && 
        (!request.delegateId || request.delegateId.length === 0)) {
      throw new Error('Either stake ID or delegate ID is required');
    }
  }

  /**
   * 罚没
   * 
   * **架构说明**：
   * Slash（罚没）是 Staking 系统的风控机制，需要明确的业务规则和合约支持。
   * 
   * **当前状态**：
   * - Slash 功能需要治理规则 / Slash 合约支持，属于后续阶段能力
   * - 当前 SDK 保留 Slash 接口，但实现为"架构预留、业务未定义"
   * 
   * **未来实现路径**（需要治理规则 / Slash 合约确定后）：
   * 1. 如果链上部署了 Slash 合约：
   *    - SDK 调用 `wes_callContract` → `method: "slash"`
   *    - 参数包括：被罚验证者地址、罚没金额、证据/理由
   *    - 合约内部根据治理逻辑构建具体消费的 UTXO & 接收方
   * 2. 如果通过治理系统实现：
   *    - 需要多方签名（ThresholdLock）
   *    - 通过 Governance 服务创建 Slash 提案
   */
  async slash(request: SlashRequest, wallet?: Wallet): Promise<SlashResult> {
    // 1. 参数验证
    this.validateSlashRequest(request);

    // 2. 获取 Wallet（罚没可能需要多方签名）
    // 当前实现：架构预留，业务未定义
    // Slash 需要治理规则 / Slash 合约支持，属于后续阶段能力
    // 当前返回明确的错误，提示需要治理规则 / Slash 合约
    // TODO: 实现 Slash 功能时需要使用 wallet
    void this.getWallet(wallet);

    throw new Error('Slash not implemented: requires governance rules or slash contract (architecture reserved, business logic undefined)');
  }

  /**
   * 验证罚没请求
   */
  private validateSlashRequest(request: SlashRequest): void {
    // 1. 验证验证者地址
    if (request.validatorAddr.length !== 20) {
      throw new Error('Validator address must be 20 bytes');
    }

    // 2. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }

    // 3. 验证原因
    if (!request.reason || request.reason.trim() === '') {
      throw new Error('Reason is required');
    }
  }
}
