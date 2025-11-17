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
   * 读取文件内容（Node.js 环境）
   */
  private async readFile(filePath: string): Promise<Uint8Array> {
    // Node.js 环境
    if (typeof require !== 'undefined') {
      const fs = require('fs').promises;
      const buffer = await fs.readFile(filePath);
      return new Uint8Array(buffer);
    }
    
    throw new Error('File reading is only supported in Node.js environment. Please provide fileContent instead.');
  }

  /**
   * Base64 编码
   * 
   * **浏览器兼容性**：
   * - 对于大数组（>65536 字节），使用分块编码避免栈溢出
   */
  private base64Encode(data: Uint8Array): string {
    // Node.js 环境
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data).toString('base64');
    }
    
    // 浏览器环境
    if (typeof btoa !== 'undefined') {
      // 对于大数组，使用分块编码避免栈溢出
      // String.fromCharCode 有参数数量限制（约 65536）
      const chunkSize = 32768; // 安全的分块大小
      if (data.length > chunkSize) {
        let result = '';
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
          result += String.fromCharCode(...chunk);
        }
        return btoa(result);
      } else {
        const binary = String.fromCharCode(...data);
        return btoa(binary);
      }
    }
    
    throw new Error('Base64 encoding is not supported in this environment');
  }

  /**
   * 部署静态资源
   * 
   * **流程**：
   * 1. 读取文件内容（Node.js 使用 fs，浏览器使用 fileContent）
   * 2. Base64 编码文件内容
   * 3. 获取私钥
   * 4. 调用 `wes_deployContract` API（静态资源可以作为特殊类型的合约）
   * 5. 解析结果
   */
  async deployStaticResource(
    request: DeployStaticResourceRequest,
    wallet?: Wallet
  ): Promise<DeployStaticResourceResult> {
    // 1. 参数验证
    this.validateDeployStaticResourceRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 读取文件内容
    let fileBytes: Uint8Array;
    if (request.fileContent) {
      fileBytes = request.fileContent;
    } else if (request.filePath) {
      fileBytes = await this.readFile(request.filePath);
    } else {
      throw new Error('Either filePath or fileContent must be provided');
    }

    // 5. Base64 编码文件内容
    const fileContentBase64 = this.base64Encode(fileBytes);

    // 6. 获取私钥（用于 API 调用）
    const privateKeyHex = w.exportPrivateKey();

    // 7. 调用 `wes_deployContract` API（静态资源可以作为特殊类型的合约）
    // 注意：当前实现使用 wes_deployContract，如果未来有专门的 wes_deployStaticResource API，可以切换
    const deployParams = {
      private_key: privateKeyHex,
      wasm_content: fileContentBase64, // 使用文件内容作为 wasm_content
      abi_version: 'v1',
      name: request.filePath || 'static_resource', // 使用文件路径作为名称
      description: `Static resource: ${request.mimeType}`,
    };

    const result = await this.client.call('wes_deployContract', [deployParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from wes_deployContract');
    }

    const resultMap = result as any;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || 'Unknown error';
      throw new Error(`Deploy static resource failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error('Missing content_hash or tx_hash in response');
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(contentHashStr.startsWith('0x') ? contentHashStr.slice(2) : contentHashStr);

    // 9. 返回结果
    return {
      contentHash,
      txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 result 获取区块高度
    };
  }

  /**
   * 验证部署静态资源请求
   */
  private validateDeployStaticResourceRequest(request: DeployStaticResourceRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证文件路径或内容
    if (!request.filePath && !request.fileContent) {
      throw new Error('Either filePath or fileContent must be provided');
    }

    // 3. 验证MIME类型
    if (!request.mimeType || request.mimeType.trim() === '') {
      throw new Error('MIME type is required');
    }
  }

  /**
   * 部署智能合约
   * 
   * **流程**：
   * 1. 读取 WASM 文件内容（Node.js 使用 fs，浏览器使用 wasmContent）
   * 2. Base64 编码 WASM 内容
   * 3. 获取私钥
   * 4. 调用 `wes_deployContract` API
   * 5. 解析结果
   */
  async deployContract(
    request: DeployContractRequest,
    wallet?: Wallet
  ): Promise<DeployContractResult> {
    // 1. 参数验证
    this.validateDeployContractRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 读取 WASM 文件内容
    let wasmBytes: Uint8Array;
    if (request.wasmContent) {
      wasmBytes = request.wasmContent;
    } else if (request.wasmPath) {
      wasmBytes = await this.readFile(request.wasmPath);
    } else {
      throw new Error('Either wasmPath or wasmContent must be provided');
    }

    // 5. Base64 编码 WASM 内容
    const wasmContentBase64 = this.base64Encode(wasmBytes);

    // 6. 获取私钥（用于 API 调用）
    const privateKeyHex = w.exportPrivateKey();

    // 7. 调用 `wes_deployContract` API
    // 注意：当前 API 需要 private_key，如果未来支持 return_unsigned_tx，可以改为使用 Wallet 签名
    const deployParams: any = {
      private_key: privateKeyHex,
      wasm_content: wasmContentBase64,
      abi_version: 'v1', // 默认 ABI 版本
      name: request.contractName,
      description: '', // 可选
    };

    // 如果有初始化参数，添加到 payload 中
    if (request.initArgs && request.initArgs.length > 0) {
      // InitArgs 是字节数组，需要 Base64 编码
      deployParams.init_args = this.base64Encode(request.initArgs);
    }

    const result = await this.client.call('wes_deployContract', [deployParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from wes_deployContract');
    }

    const resultMap = result as any;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || 'Unknown error';
      throw new Error(`Deploy contract failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error('Missing content_hash or tx_hash in response');
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(contentHashStr.startsWith('0x') ? contentHashStr.slice(2) : contentHashStr);

    // 9. 返回结果
    // 注意：合约地址通常是 contentHash（32字节）
    return {
      contractAddress: contentHash, // 使用 contentHash 作为合约地址
      contentHash,
      txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 result 获取区块高度
    };
  }

  /**
   * 验证部署合约请求
   */
  private validateDeployContractRequest(request: DeployContractRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证WASM路径或内容
    if (!request.wasmPath && !request.wasmContent) {
      throw new Error('Either wasmPath or wasmContent must be provided');
    }

    // 3. 验证合约名称
    if (!request.contractName || request.contractName.trim() === '') {
      throw new Error('Contract name is required');
    }
  }

  /**
   * 部署AI模型
   * 
   * **流程**：
   * 1. 读取模型文件内容（Node.js 使用 fs，浏览器使用 modelContent）
   * 2. Base64 编码 ONNX 内容
   * 3. 获取私钥
   * 4. 调用 `wes_deployAIModel` API
   * 5. 解析结果
   */
  async deployAIModel(
    request: DeployAIModelRequest,
    wallet?: Wallet
  ): Promise<DeployAIModelResult> {
    // 1. 参数验证
    this.validateDeployAIModelRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error('Wallet address does not match from address');
    }

    // 4. 读取 ONNX 模型文件内容
    let onnxBytes: Uint8Array;
    if (request.modelContent) {
      onnxBytes = request.modelContent;
    } else if (request.modelPath) {
      onnxBytes = await this.readFile(request.modelPath);
    } else {
      throw new Error('Either modelPath or modelContent must be provided');
    }

    // 5. Base64 编码 ONNX 内容
    const onnxContentBase64 = this.base64Encode(onnxBytes);

    // 6. 获取私钥（用于 API 调用）
    const privateKeyHex = w.exportPrivateKey();

    // 7. 调用 `wes_deployAIModel` API
    const deployParams = {
      private_key: privateKeyHex,
      onnx_content: onnxContentBase64,
      name: request.modelName,
      description: '', // 可选
    };

    const result = await this.client.call('wes_deployAIModel', [deployParams]);

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response format from wes_deployAIModel');
    }

    const resultMap = result as any;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || 'Unknown error';
      throw new Error(`Deploy AI model failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error('Missing content_hash or tx_hash in response');
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(contentHashStr.startsWith('0x') ? contentHashStr.slice(2) : contentHashStr);

    // 9. 返回结果
    return {
      contentHash,
      txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 result 获取区块高度
    };
  }

  /**
   * 验证部署AI模型请求
   */
  private validateDeployAIModelRequest(request: DeployAIModelRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error('From address must be 20 bytes');
    }

    // 2. 验证模型路径或内容
    if (!request.modelPath && !request.modelContent) {
      throw new Error('Either modelPath or modelContent must be provided');
    }

    // 3. 验证模型名称
    if (!request.modelName || request.modelName.trim() === '') {
      throw new Error('Model name is required');
    }
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
