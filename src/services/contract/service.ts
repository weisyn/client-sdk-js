/**
 * Contract 服务
 * 
 * 提供合约调用和查询的统一接口
 * 封装合约调用的完整流程：构建 payload、获取未签名交易、签名、提交
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex, hexToBytes } from '../../utils/hex';
// 强制依赖 contract-sdk-js 的 ABI 工具
import {
  type ABIMethod,
  buildAndEncodePayload,
  type BuildPayloadOptions,
} from '@weisyn/contract-sdk-js';

// BuildPayloadOptions 已从 @weisyn/contract-sdk-js 导入

/**
 * 合约调用请求
 */
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export interface CallContractRequest {
  /** 合约地址（contentHash，32字节） */
  contractAddress: Uint8Array;
  /** 方法名 */
  method: string;
  /** 方法参数 */
  args: unknown[];
  /** 调用者地址 */
  from: Uint8Array;
  /** 可选：方法信息（包含参数类型） */
  methodInfo?: ABIMethod;
  /** 可选：金额（如果需要转账） */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  amount?: string | number | bigint; // eslint-disable-line @typescript-eslint/no-redundant-type-constituents
  /** 可选：代币 ID（如果需要转账代币） */
  tokenId?: Uint8Array;
}

/**
 * 合约查询请求（只读）
 */
export interface QueryContractRequest {
  /** 合约地址（contentHash，32字节） */
  contractAddress: Uint8Array;
  /** 方法名 */
  method: string;
  /** 方法参数 */
  args: unknown[];
  /** 可选：方法信息（包含参数类型） */
  methodInfo?: ABIMethod;
}

/**
 * 合约调用结果
 */
export interface CallContractResult {
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度（如果已确认） */
  blockHeight?: number;
}

/**
 * ContractService 合约服务
 */
export class ContractService {
  constructor(
    private client: IClient,
    private wallet?: Wallet
  ) {}

  /**
   * 获取 Wallet（优先使用传入的 wallet，否则使用实例的 wallet）
   */
  private getWallet(wallet?: Wallet): Wallet {
    if (wallet) {
      return wallet;
    }
    if (this.wallet) {
      return this.wallet;
    }
    throw new Error('Wallet is required for contract invocation');
  }

  /**
   * 验证地址格式
   */
  private validateAddress(address: Uint8Array, name: string, expectedLength: number): void {
    if (!address || address.length !== expectedLength) {
      throw new Error(`${name} must be ${expectedLength} bytes, got ${address?.length || 0}`);
    }
  }

  /**
   * 验证合约调用请求参数
   */
  private validateCallRequest(request: CallContractRequest): void {
    this.validateAddress(request.contractAddress, 'Contract address', 32);
    this.validateAddress(request.from, 'From address', 20);
    
    if (!request.method || typeof request.method !== 'string') {
      throw new Error('Method name is required and must be a string');
    }

    if (!Array.isArray(request.args)) {
      throw new Error('Args must be an array');
    }

    // 验证方法信息与参数数量匹配
    if (request.methodInfo && request.methodInfo.parameters) {
      const requiredParams = request.methodInfo.parameters.filter(p => p.required !== false);
      if (request.args.length < requiredParams.length) {
        throw new Error(
          `Method ${request.method} requires at least ${requiredParams.length} parameters, ` +
          `but got ${request.args.length}`
        );
      }
    }
  }

  /**
   * 验证合约查询请求参数
   */
  private validateQueryRequest(request: QueryContractRequest): void {
    this.validateAddress(request.contractAddress, 'Contract address', 32);
    
    if (!request.method || typeof request.method !== 'string') {
      throw new Error('Method name is required and must be a string');
    }

    if (!Array.isArray(request.args)) {
      throw new Error('Args must be an array');
    }

    // 验证方法信息与参数数量匹配
    if (request.methodInfo && request.methodInfo.parameters) {
      const requiredParams = request.methodInfo.parameters.filter(p => p.required !== false);
      if (request.args.length < requiredParams.length) {
        throw new Error(
          `Method ${request.method} requires at least ${requiredParams.length} parameters, ` +
          `but got ${request.args.length}`
        );
      }
    }
  }

  /**
   * 调用合约（写操作）
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 构建 JSON payload（使用 contract-sdk-js 工具）
   * 3. 调用 `wes_callContract` API，设置 `return_unsigned_tx=true`
   * 4. 使用 Wallet 签名未签名交易
   * 5. 调用 `wes_sendRawTransaction` 提交已签名交易
   */
  async callContract(
    request: CallContractRequest,
    wallet?: Wallet
  ): Promise<CallContractResult> {
    // 1. 参数验证
    this.validateCallRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 构建 JSON payload（使用 contract-sdk-js，强制依赖）
    // 5. 构建 JSON payload
    const payloadOptions: BuildPayloadOptions = {
      includeFrom: true,
      from: request.from,
    };

    if (request.amount !== undefined) {
      payloadOptions.includeAmount = true;
      payloadOptions.amount = request.amount;
    }

    if (request.tokenId !== undefined) {
      payloadOptions.includeTokenId = true;
      payloadOptions.tokenId = request.tokenId;
    }

    let payloadBase64: string;
    try {
      payloadBase64 = buildAndEncodePayload(request.methodInfo ?? null, request.args, payloadOptions);
    } catch (error) {
      throw new Error(
        `Failed to build payload for method ${request.method}: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 6. 调用 wes_callContract API，设置 return_unsigned_tx=true
    const callContractParams = {
      content_hash: bytesToHex(request.contractAddress),
      method: request.method,
      params: [], // WASM 原生参数（通常为空）
      payload: payloadBase64,
      return_unsigned_tx: true,
    };

    let result: any;
    try {
      result = await this.client.call('wes_callContract', [callContractParams]);
    } catch (error) {
      throw new Error(
        `Failed to call contract ${bytesToHex(request.contractAddress)} method ${request.method}: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid callContract response format');
    }

    const unsignedTxHex = result.unsignedTx || result.unsigned_tx;
    if (!unsignedTxHex) {
      throw new Error('Missing unsignedTx in callContract response');
    }

    // 7. 签名交易
    let signedTxBytes: Uint8Array;
    try {
      const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
      const unsignedTxBytes = hexToBytes(cleanHex);
      signedTxBytes = await w.signTransaction(unsignedTxBytes);
    } catch (error) {
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 8. 提交交易
    const signedTxHex = '0x' + bytesToHex(signedTxBytes);
    let sendResult: any;
    try {
      sendResult = await this.client.sendRawTransaction(signedTxHex);
    } catch (error) {
      throw new Error(
        `Failed to submit transaction: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!sendResult.accepted) {
      throw new Error(
        `Transaction rejected: ${sendResult.reason || 'Unknown reason'}`
      );
    }

    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: sendResult.blockHeight,
    };
  }

  /**
   * 查询合约（只读调用）
   * 
   * **流程**：
   * 1. 验证请求参数
   * 2. 构建 JSON payload（使用 contract-sdk-js 工具）
   * 3. 调用 `wes_callContract` API（只读模式）
   */
  async queryContract(request: QueryContractRequest): Promise<any> {
    // 1. 参数验证
    this.validateQueryRequest(request);

    // 2. 构建 JSON payload（使用 contract-sdk-js，强制依赖）
    // 3. 构建 JSON payload
    let payloadBase64: string;
    try {
      payloadBase64 = buildAndEncodePayload(request.methodInfo ?? null, request.args);
    } catch (error) {
      throw new Error(
        `Failed to build payload for method ${request.method}: ` +
        `${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 4. 调用 RPC（只读查询）
    const callContractParams = {
      content_hash: bytesToHex(request.contractAddress),
      method: request.method,
      params: [], // WASM 原生参数（通常为空）
      payload: payloadBase64,
      return_unsigned_tx: false, // 只读查询，不需要交易
    };

    try {
      const result = await this.client.call('wes_callContract', [callContractParams]);
      return result;
    } catch (error) {
      // 尝试其他可能的 RPC 方法名
      try {
        return await this.client.call('wes_queryContract', [
          bytesToHex(request.contractAddress),
          request.method,
          payloadBase64,
        ]);
      } catch (fallbackError) {
        throw new Error(
          `Failed to query contract ${bytesToHex(request.contractAddress)} method ${request.method}: ` +
          `${error instanceof Error ? error.message : String(error)}`
        );
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

  // 已移除 buildPayloadFallback 函数
  // 现在强制依赖 @weisyn/contract-sdk-js，使用其 buildAndEncodePayload 函数
}

