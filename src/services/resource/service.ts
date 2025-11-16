/**
 * Resource 服务实现
 * 
 * **架构说明**：
 * - Resource 业务语义在 SDK 层，通过调用节点 API 部署和查询资源
 * - 支持静态资源、智能合约、AI 模型的部署和查询
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { bytesToHex, hexToBytes } from '../../utils/hex';
import { addressToHex } from '../../utils/address';
import {
  DeployStaticResourceRequest,
  DeployStaticResourceResult,
  DeployContractRequest,
  DeployContractResult,
  DeployAIModelRequest,
  DeployAIModelResult,
  ResourceInfo,
} from './types';

/**
 * Resource 服务
 */
export class ResourceService {
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
   * 部署静态资源
   * 
   * **流程**：
   * 1. 读取文件内容
   * 2. 计算内容哈希（CAS）
   * 3. 调用节点 API 部署资源
   * 4. 签名并提交交易
   */
  async deployStaticResource(
    request: DeployStaticResourceRequest,
    wallet?: Wallet
  ): Promise<DeployStaticResourceResult> {
    // TODO: 实现静态资源部署逻辑
    // 1. 读取文件内容（Node.js 使用 fs，浏览器使用 File API）
    // 2. 计算内容哈希
    // 3. 调用 wes_deployResource API
    // 4. 签名并提交交易
    throw new Error('Not implemented');
  }

  /**
   * 部署智能合约
   * 
   * **流程**：
   * 1. 读取 WASM 文件内容
   * 2. 计算内容哈希（CAS）
   * 3. 调用节点 API 部署合约
   * 4. 签名并提交交易
   */
  async deployContract(
    request: DeployContractRequest,
    wallet?: Wallet
  ): Promise<DeployContractResult> {
    // TODO: 实现合约部署逻辑
    // 1. 读取 WASM 文件内容
    // 2. 计算内容哈希
    // 3. 调用 wes_deployContract API
    // 4. 签名并提交交易
    throw new Error('Not implemented');
  }

  /**
   * 部署AI模型
   * 
   * **流程**：
   * 1. 读取模型文件内容
   * 2. 计算内容哈希（CAS）
   * 3. 调用节点 API 部署模型
   * 4. 签名并提交交易
   */
  async deployAIModel(
    request: DeployAIModelRequest,
    wallet?: Wallet
  ): Promise<DeployAIModelResult> {
    // TODO: 实现AI模型部署逻辑
    // 1. 读取模型文件内容
    // 2. 计算内容哈希
    // 3. 调用 wes_deployAIModel API
    // 4. 签名并提交交易
    throw new Error('Not implemented');
  }

  /**
   * 获取资源信息
   * 
   * **流程**：
   * 1. 调用节点 API 查询资源信息
   * 2. 返回资源信息
   * 
   * **注意**：不需要 Wallet
   */
  async getResource(contentHash: Uint8Array): Promise<ResourceInfo> {
    // 1. 验证 contentHash
    if (!contentHash || contentHash.length !== 32) {
      throw new Error('ContentHash must be 32 bytes');
    }

    // 2. 调用节点 API 查询资源信息
    const contentHashHex = bytesToHex(contentHash);
    const result = await this.client.call('wes_getResource', [contentHashHex]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid resource response format');
    }

    const resourceData = result as any;

    // 3. 解析并返回资源信息
    return {
      contentHash: contentHashHex,
      type: resourceData.type || 'static',
      size: resourceData.size || 0,
      mimeType: resourceData.mime_type || resourceData.mimeType,
      owner: resourceData.owner ? hexToBytes(resourceData.owner) : undefined,
    };
  }
}
