/**
 * Market 服务实现
 * 
 * **架构说明**：
 * - Market 业务语义在 SDK 层，通过调用合约方法实现
 * - 支持 AMM 交换、流动性管理、托管、归属计划等功能
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex, hexToBytes } from '../../utils/hex';
import { addressToHex } from '../../utils/address';
import { findOutputsByOwner, sumAmountsByToken, computeSignatureHashFromDraft, finalizeTransactionFromDraft } from '../../utils/tx_utils';
import { buildEscrowDraft, buildReleaseEscrowDraft, buildRefundEscrowDraft, buildVestingDraft, buildClaimVestingDraft } from './tx_builder';
import {
  SwapRequest,
  SwapResult,
  AddLiquidityRequest,
  AddLiquidityResult,
  RemoveLiquidityRequest,
  RemoveLiquidityResult,
  CreateVestingRequest,
  CreateVestingResult,
  ClaimVestingRequest,
  ClaimVestingResult,
  CreateEscrowRequest,
  CreateEscrowResult,
  ReleaseEscrowRequest,
  ReleaseEscrowResult,
  RefundEscrowRequest,
  RefundEscrowResult,
} from './types';

/**
 * Market 服务
 */
export class MarketService {
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
   * AMM 代币交换
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 构建 swap 方法参数（通过 payload）
   * 4. 调用 `wes_callContract` API，设置 `return_unsigned_tx=true` 获取未签名交易
   * 5. 使用 Wallet 签名未签名交易
   * 6. 调用 `wes_sendRawTransaction` 提交已签名交易
   * 7. 解析交易结果，提取实际输出金额
   */
  async swapAMM(request: SwapRequest, wallet?: Wallet): Promise<SwapResult> {
    // 1. 参数验证
    this.validateSwapRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 5. 构建 swap 方法的参数（通过 payload）
    const swapParams: any = {
      from: addressToHex(request.from),
      tokenIn: request.tokenIn ? bytesToHex(request.tokenIn) : '',
      tokenOut: request.tokenOut ? bytesToHex(request.tokenOut) : '',
      amountIn: typeof request.amountIn === 'bigint' ? request.amountIn.toString() : request.amountIn.toString(),
      amountOutMin: typeof request.amountOutMin === 'bigint' ? request.amountOutMin.toString() : request.amountOutMin.toString(),
    };

    // 将参数编码为 JSON，然后 Base64 编码
    const payloadJSON = JSON.stringify(swapParams);
    const payloadBase64 = Buffer.from(payloadJSON).toString('base64');

    // 6. 调用 wes_callContract API，设置 return_unsigned_tx=true
    const callContractParams = {
      content_hash: bytesToHex(request.ammContractAddr),
      method: 'swap',
      params: [], // WASM 原生参数（空，使用 payload）
      payload: payloadBase64,
      return_unsigned_tx: true,
    };

    const result = await this.client.call('wes_callContract', [callContractParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid callContract response format');
    }

    const resultMap = result as { unsignedTx?: string; unsigned_tx?: string };
    const unsignedTxHex = resultMap.unsignedTx || resultMap.unsigned_tx;

    if (!unsignedTxHex) {
      throw new Error('Missing unsignedTx in callContract response');
    }

    // 7. 解码未签名交易
    const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
    const unsignedTxBytes = hexToBytes(cleanHex);

    // 8. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 9. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = '0x' + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取实际输出金额
    let amountOut = typeof request.amountOutMin === 'bigint' ? request.amountOutMin : BigInt(request.amountOutMin);

    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];

        // 查找返回给用户的输出（owner 是交换者地址）
        const userOutputs = findOutputsByOwner(outputs, request.from);

        // 汇总 tokenOut 金额
        if (request.tokenOut && request.tokenOut.length > 0) {
          const totalAmount = sumAmountsByToken(userOutputs, request.tokenOut);
          if (totalAmount !== null) {
            amountOut = totalAmount;
          }
        } else {
          // 原生币
          const totalAmount = sumAmountsByToken(userOutputs, null);
          if (totalAmount !== null) {
            amountOut = totalAmount;
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    return {
      txHash: sendResult.txHash,
      amountOut,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证交换请求
   */
  private validateSwapRequest(request: SwapRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 3. 验证金额
    const amountIn = typeof request.amountIn === 'bigint' ? request.amountIn : BigInt(request.amountIn);
    if (amountIn <= BigInt(0)) {
      throw new Error('AmountIn must be greater than 0');
    }
    const amountOutMin = typeof request.amountOutMin === 'bigint' ? request.amountOutMin : BigInt(request.amountOutMin);
    if (amountOutMin <= BigInt(0)) {
      throw new Error('Minimum amount out must be greater than 0');
    }

    // 4. 验证代币不同
    const tokenInHex = request.tokenIn ? bytesToHex(request.tokenIn) : '';
    const tokenOutHex = request.tokenOut ? bytesToHex(request.tokenOut) : '';
    if (tokenInHex === tokenOutHex) {
      throw new Error('Token in and token out must be different');
    }
  }

  /**
   * 添加流动性
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 构建 addLiquidity 方法参数（通过 payload）
   * 4. 调用 `wes_callContract` API，设置 `return_unsigned_tx=true` 获取未签名交易
   * 5. 使用 Wallet 签名未签名交易
   * 6. 调用 `wes_sendRawTransaction` 提交已签名交易
   * 7. 解析交易结果，提取 LiquidityID
   */
  async addLiquidity(request: AddLiquidityRequest, wallet?: Wallet): Promise<AddLiquidityResult> {
    // 1. 参数验证
    this.validateAddLiquidityRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 5. 构建 addLiquidity 方法的参数（通过 payload）
    const addLiquidityParams: any = {
      from: addressToHex(request.from),
      tokenA: bytesToHex(request.tokenA),
      tokenB: bytesToHex(request.tokenB),
      amountA: typeof request.amountA === 'bigint' ? request.amountA.toString() : request.amountA.toString(),
      amountB: typeof request.amountB === 'bigint' ? request.amountB.toString() : request.amountB.toString(),
    };

    // 将参数编码为 JSON，然后 Base64 编码
    const payloadJSON = JSON.stringify(addLiquidityParams);
    const payloadBase64 = Buffer.from(payloadJSON).toString('base64');

    // 6. 调用 wes_callContract API，设置 return_unsigned_tx=true
    const callContractParams = {
      content_hash: bytesToHex(request.ammContractAddr),
      method: 'addLiquidity',
      params: [], // WASM 原生参数（空，使用 payload）
      payload: payloadBase64,
      return_unsigned_tx: true,
    };

    const result = await this.client.call('wes_callContract', [callContractParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid callContract response format');
    }

    const resultMap = result as { unsignedTx?: string; unsigned_tx?: string };
    const unsignedTxHex = resultMap.unsignedTx || resultMap.unsigned_tx;

    if (!unsignedTxHex) {
      throw new Error('Missing unsignedTx in callContract response');
    }

    // 7. 解码未签名交易
    const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
    const unsignedTxBytes = hexToBytes(cleanHex);

    // 8. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 9. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = '0x' + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取 LiquidityID
    let liquidityID = new Uint8Array(0);
    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找流动性输出（通常是第一个资产输出，且 owner 是流动性提供者地址）
        for (const output of outputs) {
          const outputType = output.type || output.Type;
          const outputOwner = output.owner || output.Owner;
          
          if (outputType === 'asset') {
            const ownerBytes = typeof outputOwner === 'string'
              ? hexToBytes(outputOwner.startsWith('0x') ? outputOwner.slice(2) : outputOwner)
              : new Uint8Array(outputOwner);
            
            if (this.addressesEqual(ownerBytes, request.from)) {
              const outpoint = output.outpoint || output.Outpoint || '';
              liquidityID = new TextEncoder().encode(outpoint);
              break;
            }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空数组
    }

    return {
      txHash: sendResult.txHash,
      liquidityId: liquidityID,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证添加流动性请求
   */
  private validateAddLiquidityRequest(request: AddLiquidityRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 3. 验证金额
    const amountA = typeof request.amountA === 'bigint' ? request.amountA : BigInt(request.amountA);
    const amountB = typeof request.amountB === 'bigint' ? request.amountB : BigInt(request.amountB);
    if (amountA <= BigInt(0) || amountB <= BigInt(0)) {
      throw new Error('Both amounts must be greater than 0');
    }
  }

  /**
   * 移除流动性
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 构建 removeLiquidity 方法参数（通过 payload）
   * 4. 调用 `wes_callContract` API，设置 `return_unsigned_tx=true` 获取未签名交易
   * 5. 使用 Wallet 签名未签名交易
   * 6. 调用 `wes_sendRawTransaction` 提交已签名交易
   * 7. 解析交易结果，提取实际获得的代币金额
   */
  async removeLiquidity(request: RemoveLiquidityRequest, wallet?: Wallet): Promise<RemoveLiquidityResult> {
    // 1. 参数验证
    this.validateRemoveLiquidityRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 5. 构建 removeLiquidity 方法的参数（通过 payload）
    const liquidityIDStr = new TextDecoder().decode(request.liquidityId);
    const removeLiquidityParams: any = {
      from: addressToHex(request.from),
      liquidityID: liquidityIDStr,
      amount: typeof request.amount === 'bigint' ? request.amount.toString() : request.amount.toString(),
    };

    // 将参数编码为 JSON，然后 Base64 编码
    const payloadJSON = JSON.stringify(removeLiquidityParams);
    const payloadBase64 = Buffer.from(payloadJSON).toString('base64');

    // 6. 调用 wes_callContract API，设置 return_unsigned_tx=true
    const callContractParams = {
      content_hash: bytesToHex(request.ammContractAddr),
      method: 'removeLiquidity',
      params: [], // WASM 原生参数（空，使用 payload）
      payload: payloadBase64,
      return_unsigned_tx: true,
    };

    const result = await this.client.call('wes_callContract', [callContractParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid callContract response format');
    }

    const resultMap = result as { unsignedTx?: string; unsigned_tx?: string };
    const unsignedTxHex = resultMap.unsignedTx || resultMap.unsigned_tx;

    if (!unsignedTxHex) {
      throw new Error('Missing unsignedTx in callContract response');
    }

    // 7. 解码未签名交易
    const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
    const unsignedTxBytes = hexToBytes(cleanHex);

    // 8. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 9. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = '0x' + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || 'Unknown reason'}`);
    }

    // 10. 解析交易结果，提取实际获得的代币金额
    let amountA = BigInt(0);
    let amountB = BigInt(0);

    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找返回给用户的输出（owner 是流动性提供者地址）
        const userOutputs = findOutputsByOwner(outputs, request.from);
        
        // 分别汇总 TokenA 和 TokenB 的金额
        // 简化处理：汇总所有代币输出，按顺序分配
        const amounts: bigint[] = [];
        for (const output of userOutputs) {
          const outputAmount = output.amount || output.Amount;
          if (outputAmount) {
            const amount = typeof outputAmount === 'string' ? BigInt(outputAmount) : BigInt(outputAmount);
            amounts.push(amount);
          }
        }
        
        if (amounts.length >= 1) {
          amountA = amounts[0];
        }
        if (amounts.length >= 2) {
          amountB = amounts[1];
        }
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    return {
      txHash: sendResult.txHash,
      amountA,
      amountB,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证移除流动性请求
   */
  private validateRemoveLiquidityRequest(request: RemoveLiquidityRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证 AMM 合约地址（contentHash，32字节）
    if (request.ammContractAddr.length !== 32) {
      throw new Error('AMM contract address must be 32 bytes (contentHash)');
    }

    // 3. 验证流动性ID
    if (request.liquidityId.length === 0) {
      throw new Error('Liquidity ID is required');
    }

    // 4. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }
  }

  /**
   * 创建归属计划
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（使用 TimeLock + SingleKeyLock/ContractLock）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 VestingID
   */
  async createVesting(request: CreateVestingRequest, wallet?: Wallet): Promise<CreateVestingResult> {
    // 1. 参数验证
    this.validateCreateVestingRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    const startTime = typeof request.startTime === 'bigint' ? request.startTime : BigInt(request.startTime);
    const duration = typeof request.duration === 'bigint' ? request.duration : BigInt(request.duration);
    
    const { draft, inputIndex } = await buildVestingDraft(
      this.client,
      request.from,
      request.to,
      amount,
      request.tokenId ?? new Uint8Array(0), // null 表示原生币，传递空数组
      startTime,
      duration
      // TODO: 支持 vestingContractAddr 参数
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
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
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

    // 10. 解析交易结果，提取 VestingID
    let vestingID = new Uint8Array(0);
    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找归属输出（通常是第一个资产输出，且 owner 是受益人地址）
        // 归属输出通常带有 TimeLock
        for (const output of outputs) {
          const outputType = output.type || output.Type;
          const outputOwner = output.owner || output.Owner;
          
          if (outputType === 'asset') {
            const ownerBytes = typeof outputOwner === 'string'
              ? hexToBytes(outputOwner.startsWith('0x') ? outputOwner.slice(2) : outputOwner)
              : new Uint8Array(outputOwner);
            
            if (this.addressesEqual(ownerBytes, request.to)) {
              const outpoint = output.outpoint || output.Outpoint || '';
              vestingID = new TextEncoder().encode(outpoint);
              break;
            }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空数组
    }

    return {
      txHash: sendResult.txHash,
      vestingId: vestingID,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证创建归属计划请求
   */
  private validateCreateVestingRequest(request: CreateVestingRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }
    if (request.to.length !== 20) {
      throw new Error('To address must be 20 bytes');
    }

    // 2. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }

    // 3. 验证时间
    const duration = typeof request.duration === 'bigint' ? request.duration : BigInt(request.duration);
    if (duration <= BigInt(0)) {
      throw new Error('Duration must be greater than 0');
    }
  }

  /**
   * 领取归属代币
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（消费归属 UTXO）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取实际领取金额
   * 
   * **注意**：
   * - 需要满足 TimeLock 的解锁条件（当前时间 >= unlock_timestamp）
   */
  async claimVesting(request: ClaimVestingRequest, wallet?: Wallet): Promise<ClaimVestingResult> {
    // 1. 参数验证
    this.validateClaimVestingRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const { draft, inputIndex } = await buildClaimVestingDraft(
      this.client,
      request.from,
      request.vestingId
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
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
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

    // 10. 解析交易结果，提取实际领取金额
    let claimAmount = BigInt(0);

    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找返回给用户的输出（owner 是领取者地址）
        const userOutputs = findOutputsByOwner(outputs, request.from);
        
        // 汇总金额（归属代币可能是原生币或特定代币）
        const totalAmount = sumAmountsByToken(userOutputs, null);
        if (totalAmount !== null) {
          claimAmount = totalAmount;
        }
      }
    } catch (e) {
      // 忽略解析错误，使用默认值
    }

    return {
      txHash: sendResult.txHash,
      claimAmount,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证领取归属代币请求
   */
  private validateClaimVestingRequest(request: ClaimVestingRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证归属计划ID
    if (request.vestingId.length === 0) {
      throw new Error('Vesting ID is required');
    }
  }

  /**
   * 创建托管
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配（买方创建托管）
   * 3. 在 SDK 层构建交易草稿（使用 MultiKeyLock）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 EscrowID
   */
  async createEscrow(request: CreateEscrowRequest, wallet?: Wallet): Promise<CreateEscrowResult> {
    // 1. 参数验证
    this.validateCreateEscrowRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配（买方创建托管）
    if (!this.addressesEqual(w.address, request.buyer)) {
      throw new Error('Wallet address does not match buyer address');
    }

    // 4. 在 SDK 层构建交易草稿
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    const expiry = typeof request.expiry === 'bigint' ? request.expiry : BigInt(request.expiry);
    
    const { draft, inputIndex } = await buildEscrowDraft(
      this.client,
      request.buyer,
      request.seller,
      amount,
      request.tokenId ?? new Uint8Array(0), // null 表示原生币，传递空数组
      expiry
      // TODO: 支持 escrowContractAddr 参数
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
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
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

    // 10. 解析交易结果，提取 EscrowID
    let escrowID = new Uint8Array(0);
    try {
      // 查询交易详情
      const txResult = await this.client.call('wes_getTransactionByHash', [sendResult.txHash]);
      if (txResult && typeof txResult === 'object') {
        const txData = txResult as any;
        const outputs = txData.outputs || txData.Outputs || [];
        
        // 查找托管输出（通常是第一个资产输出，且 owner 是买方或卖方地址）
        // 托管输出通常带有 MultiKeyLock
        for (const output of outputs) {
          const outputType = output.type || output.Type;
          const outputOwner = output.owner || output.Owner;
          
          if (outputType === 'asset') {
            const ownerBytes = typeof outputOwner === 'string'
              ? hexToBytes(outputOwner.startsWith('0x') ? outputOwner.slice(2) : outputOwner)
              : new Uint8Array(outputOwner);
            
            if (this.addressesEqual(ownerBytes, request.buyer) || 
                this.addressesEqual(ownerBytes, request.seller)) {
              const outpoint = output.outpoint || output.Outpoint || '';
              escrowID = new TextEncoder().encode(outpoint);
              break;
            }
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空数组
    }

    return {
      txHash: sendResult.txHash,
      escrowId: escrowID,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证创建托管请求
   */
  private validateCreateEscrowRequest(request: CreateEscrowRequest): void {
    // 1. 验证地址
    if (request.buyer.length !== 20) {
      throw new Error('Buyer address must be 20 bytes');
    }
    if (request.seller.length !== 20) {
      throw new Error('Seller address must be 20 bytes');
    }

    // 2. 验证金额
    const amount = typeof request.amount === 'bigint' ? request.amount : BigInt(request.amount);
    if (amount <= BigInt(0)) {
      throw new Error('Amount must be greater than 0');
    }

    // 3. 验证过期时间
    const expiry = typeof request.expiry === 'bigint' ? request.expiry : BigInt(request.expiry);
    if (expiry <= BigInt(0)) {
      throw new Error('Expiry time is required');
    }
  }

  /**
   * 释放托管给卖方
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（消费托管 UTXO）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 
   * **注意**：
   * - MultiKeyLock 需要买方和卖方都签名，当前实现只处理买方签名部分
   * - 实际使用中，可能需要多方签名流程
   */
  async releaseEscrow(request: ReleaseEscrowRequest, wallet?: Wallet): Promise<ReleaseEscrowResult> {
    // 1. 参数验证
    this.validateReleaseEscrowRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const { draft, inputIndex } = await buildReleaseEscrowDraft(
      this.client,
      request.from,
      request.sellerAddress,
      request.escrowId
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
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
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
    // 注意：MultiKeyLock 需要买方和卖方都签名，当前实现只处理买方签名
    // 实际使用中，可能需要多方签名流程
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
   * 验证释放托管请求
   */
  private validateReleaseEscrowRequest(request: ReleaseEscrowRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }
    if (request.sellerAddress.length !== 20) {
      throw new Error('Seller address must be 20 bytes');
    }

    // 2. 验证托管ID
    if (request.escrowId.length === 0) {
      throw new Error('Escrow ID is required');
    }
  }

  /**
   * 退款托管给买方
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（消费托管 UTXO）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 
   * **注意**：
   * - 退款托管在过期后可以退款给买方（TimeLock + MultiKeyLock）
   */
  async refundEscrow(request: RefundEscrowRequest, wallet?: Wallet): Promise<RefundEscrowResult> {
    // 1. 参数验证
    this.validateRefundEscrowRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 在 SDK 层构建交易草稿
    const { draft, inputIndex } = await buildRefundEscrowDraft(
      this.client,
      request.from,
      request.buyerAddress,
      request.escrowId
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
      const { Point } = require('@noble/secp256k1');
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true);
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
   * 验证退款托管请求
   */
  private validateRefundEscrowRequest(request: RefundEscrowRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }
    if (request.buyerAddress.length !== 20) {
      throw new Error('Buyer address must be 20 bytes');
    }

    // 2. 验证托管ID
    if (request.escrowId.length === 0) {
      throw new Error('Escrow ID is required');
    }
  }
}
