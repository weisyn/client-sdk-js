/**
 * Resource 服务实现
 *
 * **架构说明**：
 * - Resource 业务语义在 SDK 层，通过调用节点 API 部署和查询资源
 * - 支持静态资源、智能合约、AI 模型的部署和查询
 */

import { IClient } from "../../client/client";
import { Wallet } from "../../wallet/wallet";
import { bytesToHex, hexToBytes } from "../../utils/hex";
import { WESClientImpl } from "../../client/wesclient";
import type { WESClient } from "../../client/wesclient";
import type { ResourceFilters } from "../../client/wesclient-types";
import {
  DeployStaticResourceRequest,
  DeployStaticResourceResult,
  DeployContractRequest,
  DeployContractResult,
  DeployAIModelRequest,
  DeployAIModelResult,
  ResourceInfo,
  ResourceView,
  ResourceHistory,
} from "./types";
import {
  convertLockingConditionsToProto,
  createDefaultSingleKeyLock,
  validateLockingConditions,
  type LockingCondition,
} from "./locking";

/**
 * Resource 服务
 */
export class ResourceService {
  private wesClient?: WESClient;

  constructor(
    private client: IClient,
    private wallet?: Wallet
  ) {}

  /**
   * 获取 WESClient（延迟初始化）
   */
  private getWESClient(): WESClient {
    if (!this.wesClient) {
      this.wesClient = new WESClientImpl(this.client);
    }
    return this.wesClient;
  }

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
    throw new Error("Wallet is required");
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
    if (typeof require !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs").promises;
      const buffer = await fs.readFile(filePath);
      return new Uint8Array(buffer);
    }

    throw new Error(
      "File reading is only supported in Node.js environment. Please provide fileContent instead."
    );
  }

  /**
   * Base64 编码
   *
   * **浏览器兼容性**：
   * - 对于大数组（>65536 字节），使用分块编码避免栈溢出
   */
  private base64Encode(data: Uint8Array): string {
    // Node.js 环境
    if (typeof Buffer !== "undefined") {
      return Buffer.from(data).toString("base64");
    }

    // 浏览器环境
    if (typeof btoa !== "undefined") {
      // 对于大数组，使用分块编码避免栈溢出
      // String.fromCharCode 有参数数量限制（约 65536）
      const chunkSize = 32768; // 安全的分块大小
      if (data.length > chunkSize) {
        let result = "";
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

    throw new Error("Base64 encoding is not supported in this environment");
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
      throw new Error("Wallet address does not match from address");
    }

    // 4. 读取文件内容
    let fileBytes: Uint8Array;
    if (request.fileContent) {
      fileBytes = request.fileContent;
    } else if (request.filePath) {
      fileBytes = await this.readFile(request.filePath);
    } else {
      throw new Error("Either filePath or fileContent must be provided");
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
      abi_version: "v1",
      name: request.filePath || "static_resource", // 使用文件路径作为名称
      description: `Static resource: ${request.mimeType}`,
    };

    const result = await this.client.call("wes_deployContract", [deployParams]);

    if (!result || typeof result !== "object") {
      throw new Error("Invalid response format from wes_deployContract");
    }

    const resultMap = result;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || "Unknown error";
      throw new Error(`Deploy static resource failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error("Missing content_hash or tx_hash in response");
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(
      contentHashStr.startsWith("0x") ? contentHashStr.slice(2) : contentHashStr
    );

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
      throw new Error("From address must be 20 bytes");
    }

    // 2. 验证文件路径或内容
    if (!request.filePath && !request.fileContent) {
      throw new Error("Either filePath or fileContent must be provided");
    }

    // 3. 验证MIME类型
    if (!request.mimeType || request.mimeType.trim() === "") {
      throw new Error("MIME type is required");
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

    // 2. ✅ 验证锁定条件（如果提供）
    if (request.lockingConditions && request.lockingConditions.length > 0) {
      const shouldValidate = request.validateLockingConditions !== false; // 默认 true
      if (shouldValidate) {
        validateLockingConditions(
          request.lockingConditions,
          request.allowContractLockCycles ?? false
        );
      }
    }

    // 3. 获取 Wallet
    const w = this.getWallet(wallet);

    // 4. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error("Wallet address does not match from address");
    }

    // 5. 读取 WASM 文件内容
    let wasmBytes: Uint8Array;
    if (request.wasmContent) {
      wasmBytes = request.wasmContent;
    } else if (request.wasmPath) {
      wasmBytes = await this.readFile(request.wasmPath);
    } else {
      throw new Error("Either wasmPath or wasmContent must be provided");
    }

    // 6. Base64 编码 WASM 内容
    const wasmContentBase64 = this.base64Encode(wasmBytes);

    // 7. 获取私钥（用于 API 调用）
    const privateKeyHex = w.exportPrivateKey();

    // 8. ✅ 构造锁定条件（转换为 proto 格式）
    let lockingConditionsProto: any[];
    if (request.lockingConditions && request.lockingConditions.length > 0) {
      lockingConditionsProto = convertLockingConditionsToProto(request.lockingConditions);
      console.log(
        "[ResourceService] 使用用户指定的锁定条件:",
        JSON.stringify(lockingConditionsProto, null, 2)
      );
    } else {
      // 默认：单密钥锁（部署者地址）
      lockingConditionsProto = createDefaultSingleKeyLock(w.address);
      console.log(
        "[ResourceService] 使用默认单密钥锁:",
        JSON.stringify(lockingConditionsProto, null, 2)
      );
    }

    // 9. 调用 `wes_deployContract` API
    // 注意：当前 API 需要 private_key，如果未来支持 return_unsigned_tx，可以改为使用 Wallet 签名
    const deployParams: any = {
      private_key: privateKeyHex,
      wasm_content: wasmContentBase64,
      abi_version: "v1", // 默认 ABI 版本
      name: request.contractName,
      description: "", // 可选
      locking_conditions: lockingConditionsProto, // ✅ 新增字段
    };

    console.log("[ResourceService] 部署参数（不含私钥）:", {
      ...deployParams,
      private_key: "[REDACTED]",
      wasm_content: `${deployParams.wasm_content.substring(0, 50)}...`,
    });

    // 如果有初始化参数，添加到 payload 中
    if (request.initArgs && request.initArgs.length > 0) {
      // InitArgs 是字节数组，需要 Base64 编码
      deployParams.init_args = this.base64Encode(request.initArgs);
    }

    const result = await this.client.call("wes_deployContract", [deployParams]);

    if (!result || typeof result !== "object") {
      throw new Error("Invalid response format from wes_deployContract");
    }

    const resultMap = result;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || "Unknown error";
      throw new Error(`Deploy contract failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error("Missing content_hash or tx_hash in response");
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(
      contentHashStr.startsWith("0x") ? contentHashStr.slice(2) : contentHashStr
    );

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
      throw new Error("From address must be 20 bytes");
    }

    // 2. 验证WASM路径或内容
    if (!request.wasmPath && !request.wasmContent) {
      throw new Error("Either wasmPath or wasmContent must be provided");
    }

    // 3. 验证合约名称
    if (!request.contractName || request.contractName.trim() === "") {
      throw new Error("Contract name is required");
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
      throw new Error("Wallet address does not match from address");
    }

    // 4. 读取 ONNX 模型文件内容
    let onnxBytes: Uint8Array;
    if (request.modelContent) {
      onnxBytes = request.modelContent;
    } else if (request.modelPath) {
      onnxBytes = await this.readFile(request.modelPath);
    } else {
      throw new Error("Either modelPath or modelContent must be provided");
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
      description: "", // 可选
    };

    const result = await this.client.call("wes_deployAIModel", [deployParams]);

    if (!result || typeof result !== "object") {
      throw new Error("Invalid response format from wes_deployAIModel");
    }

    const resultMap = result;

    const success = resultMap.success;
    if (!success) {
      const message = resultMap.message || "Unknown error";
      throw new Error(`Deploy AI model failed: ${message}`);
    }

    const contentHashStr = resultMap.content_hash || resultMap.contentHash;
    const txHash = resultMap.tx_hash || resultMap.txHash;

    if (!contentHashStr || !txHash) {
      throw new Error("Missing content_hash or tx_hash in response");
    }

    // 8. 解析 contentHash
    const contentHash = hexToBytes(
      contentHashStr.startsWith("0x") ? contentHashStr.slice(2) : contentHashStr
    );

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
      throw new Error("From address must be 20 bytes");
    }

    // 2. 验证模型路径或内容
    if (!request.modelPath && !request.modelContent) {
      throw new Error("Either modelPath or modelContent must be provided");
    }

    // 3. 验证模型名称
    if (!request.modelName || request.modelName.trim() === "") {
      throw new Error("Model name is required");
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
      throw new Error("ContentHash must be 32 bytes");
    }

    // 2. 使用 WESClient 查询资源信息
    const wesClient = this.getWESClient();
    const resourceInfo = await wesClient.getResource(contentHash);

    // 3. 转换为 ResourceService 的 ResourceInfo 格式
    return {
      contentHash: bytesToHex(resourceInfo.contentHash),
      type: mapResourceType(resourceInfo.resourceType),
      size: resourceInfo.size,
      mimeType: resourceInfo.mimeType,
      owner: undefined, // TODO: 从 lockingConditions 推导 owner
    };
  }

  /**
   * 获取资源列表
   *
   * **流程**：
   * 1. 使用 WESClient 查询资源列表
   * 2. 转换为 ResourceService 的 ResourceInfo 格式
   *
   * **注意**：不需要 Wallet
   */
  async getResources(filters: ResourceFilters): Promise<ResourceInfo[]> {
    const wesClient = this.getWESClient();
    const resources = await wesClient.getResources(filters);

    // 转换为 ResourceService 的 ResourceInfo 格式
    return resources.map((resourceInfo) => ({
      contentHash: bytesToHex(resourceInfo.contentHash),
      type: mapResourceType(resourceInfo.resourceType),
      size: resourceInfo.size,
      mimeType: resourceInfo.mimeType,
      owner: undefined, // TODO: 从 lockingConditions 推导 owner
    }));
  }

  /**
   * 列出资源列表（新版本，使用 ResourceView）
   *
   * **流程**：
   * 1. 调用 `wes_listResources` API
   * 2. 解析返回的 ResourceView 数组
   *
   * **注意**：不需要 Wallet
   */
  async listResources(filters: ResourceFilters): Promise<ResourceView[]> {
    // 1. 构建过滤器参数
    const filterMap: any = {};
    if (filters.resourceType) {
      filterMap.resourceType = filters.resourceType;
    }
    if (filters.owner && filters.owner.length > 0) {
      filterMap.owner = "0x" + bytesToHex(filters.owner);
    }
    if (filters.limit) {
      filterMap.limit = filters.limit;
    }
    if (filters.offset) {
      filterMap.offset = filters.offset;
    }

    // 2. 调用 wes_listResources API
    const result = await this.client.call("wes_listResources", [{ filters: filterMap }]);

    // 3. 解析结果数组
    if (!Array.isArray(result)) {
      throw new Error("Invalid response format: expected array");
    }

    // 4. 转换每个 ResourceView 对象
    return result.map((item: any) => this.parseResourceView(item));
  }

  /**
   * 获取资源视图（新版本，使用 ResourceView）
   *
   * **流程**：
   * 1. 调用 `wes_getResource` API
   * 2. 解析返回的 ResourceView
   *
   * **注意**：不需要 Wallet
   */
  async getResourceView(contentHash: Uint8Array): Promise<ResourceView> {
    // 1. 验证 contentHash
    if (!contentHash || contentHash.length !== 32) {
      throw new Error("ContentHash must be 32 bytes");
    }

    // 2. 构建查询参数
    const contentHashHex = bytesToHex(contentHash);
    const params = [contentHashHex];

    // 3. 调用 wes_getResource API
    const result = await this.client.call("wes_getResource", params);

    // 4. 解析结果
    if (typeof result !== "object" || result === null) {
      throw new Error("Invalid response format");
    }

    // 5. 解析 ResourceView
    return this.parseResourceView(result);
  }

  /**
   * 获取资源历史
   *
   * **流程**：
   * 1. 调用 `wes_getResourceHistory` API
   * 2. 解析返回的 ResourceHistory
   *
   * **注意**：不需要 Wallet
   */
  async getResourceHistory(
    contentHash: Uint8Array,
    offset: number = 0,
    limit: number = 50
  ): Promise<ResourceHistory> {
    // 1. 验证 contentHash
    if (!contentHash || contentHash.length !== 32) {
      throw new Error("ContentHash must be 32 bytes");
    }

    // 2. 构建查询参数
    const contentHashHex = bytesToHex(contentHash);
    const params = [
      {
        resourceId: "0x" + contentHashHex,
        offset,
        limit,
      },
    ];

    // 3. 调用 wes_getResourceHistory API
    const result = await this.client.call("wes_getResourceHistory", params);

    // 4. 解析结果
    if (typeof result !== "object" || result === null) {
      throw new Error("Invalid response format");
    }

    const resultMap = result;
    const history: ResourceHistory = {
      upgrades: [],
    };

    // 解析部署交易
    if (resultMap.deployTx) {
      history.deployTx = this.parseTxSummary(resultMap.deployTx);
    }

    // 解析升级交易
    if (Array.isArray(resultMap.upgrades)) {
      history.upgrades = resultMap.upgrades.map((tx: any) => this.parseTxSummary(tx));
    }

    // 解析引用统计
    if (resultMap.referencesSummary) {
      history.referencesSummary = {
        totalReferences: resultMap.referencesSummary.totalReferences || 0,
        uniqueCallers: resultMap.referencesSummary.uniqueCallers || 0,
        lastReferenceTime: resultMap.referencesSummary.lastReferenceTime || 0,
      };
    }

    return history;
  }

  /**
   * 解析 ResourceView
   */
  private parseResourceView(itemMap: any): ResourceView {
    const view: ResourceView = {
      contentHash: itemMap.contentHash || "",
      category: itemMap.category || "STATIC",
      executableType: itemMap.executableType,
      mimeType: itemMap.mimeType,
      size: itemMap.size || 0,
      owner: itemMap.owner || "",
      status: itemMap.status || "ACTIVE",
      creationTimestamp: itemMap.creationTimestamp || 0,
      isImmutable: itemMap.isImmutable || false,
      currentReferenceCount: itemMap.currentReferenceCount || 0,
      totalReferenceTimes: itemMap.totalReferenceTimes || 0,
      deployTxId: itemMap.deployTxId || "",
      deployBlockHeight: itemMap.deployBlockHeight || 0,
      deployBlockHash: itemMap.deployBlockHash || "",
    };

    // 解析 OutPoint
    if (itemMap.outPoint) {
      view.outPoint = {
        txId: itemMap.outPoint.txId || "",
        outputIndex: itemMap.outPoint.outputIndex || 0,
      };
    }

    // 解析过期时间戳
    if (itemMap.expiryTimestamp !== undefined) {
      view.expiryTimestamp = itemMap.expiryTimestamp;
    }

    // ✅ 新增：解析锁定条件
    if (itemMap.lockingConditions && Array.isArray(itemMap.lockingConditions)) {
      view.lockingConditions = this.parseLockingConditions(itemMap.lockingConditions);
    }

    return view;
  }

  /**
   * 解析锁定条件数组（从节点返回的 protojson 格式）
   */
  private parseLockingConditions(lcArray: any[]): LockingCondition[] {
    const conditions: LockingCondition[] = [];
    for (const lc of lcArray) {
      try {
        const condition = this.parseSingleLockingCondition(lc);
        if (condition) {
          conditions.push(condition);
        }
      } catch (error) {
        // 解析失败时跳过，不影响其他条件
        console.warn("解析锁定条件失败:", error, lc);
      }
    }
    return conditions;
  }

  /**
   * 解析单个锁定条件
   */
  private parseSingleLockingCondition(lc: any): LockingCondition | null {
    // 节点返回的是 protojson 格式，字段名使用 snake_case
    if (lc.single_key_lock) {
      const skl = lc.single_key_lock;
      const addressHex = skl.public_key?.value || skl.required_address_hash || "";
      if (!addressHex) {
        return null;
      }
      return {
        type: "singleKey",
        requiredAddressHash: hexToBytes(addressHex),
        algorithm: skl.public_key?.algorithm || skl.required_algorithm || "ECDSA_SECP256K1",
      };
    }
    if (lc.multi_key_lock) {
      const mkl = lc.multi_key_lock;
      return {
        type: "multiKey",
        requiredSignatures: mkl.required_signatures || 0,
        authorizedKeys: (mkl.authorized_keys || []).map((k: any) => ({
          value: hexToBytes(k.value || ""),
          algorithm: k.algorithm || "ECDSA_SECP256K1",
        })),
        requireOrderedSignatures: mkl.require_ordered_signatures || false,
      };
    }
    if (lc.time_lock) {
      const tl = lc.time_lock;
      const baseLock = tl.base_lock ? this.parseSingleLockingCondition(tl.base_lock) : null;
      if (!baseLock) {
        return null;
      }
      return {
        type: "timeLock",
        unlockTimestamp: tl.unlock_timestamp || 0,
        baseLock: baseLock,
      };
    }
    if (lc.height_lock) {
      const hl = lc.height_lock;
      const baseLock = hl.base_lock ? this.parseSingleLockingCondition(hl.base_lock) : null;
      if (!baseLock) {
        return null;
      }
      return {
        type: "heightLock",
        unlockHeight: hl.unlock_height || 0,
        baseLock: baseLock,
        confirmationBlocks: hl.confirmation_blocks || 6,
      };
    }
    if (lc.delegation_lock) {
      const dl = lc.delegation_lock;
      return {
        type: "delegation",
        originalOwner: hexToBytes(dl.original_owner || ""),
        allowedDelegates: (dl.allowed_delegates || []).map((addr: string) => hexToBytes(addr)),
        authorizedOperations: dl.authorized_operations || [],
        expiryDurationBlocks: dl.expiry_duration_blocks || 0,
        maxValuePerOperation: dl.max_value_per_operation || 0,
      };
    }
    if (lc.contract_lock) {
      const cl = lc.contract_lock;
      return {
        type: "contract",
        contractAddress: hexToBytes(cl.contract_address || ""),
        requiredMethod: cl.required_method || "",
        parameterSchema: cl.parameter_schema || "",
        stateRequirements: cl.state_requirements || [],
        maxExecutionTimeMs: cl.max_execution_time_ms || 5000,
      };
    }
    if (lc.threshold_lock) {
      const tl = lc.threshold_lock;
      return {
        type: "threshold",
        threshold: tl.threshold || 0,
        totalParties: tl.total_parties || 0,
        partyVerificationKeys: (tl.party_verification_keys || []).map((key: string) =>
          hexToBytes(key)
        ),
        signatureScheme: tl.signature_scheme || "BLS_THRESHOLD",
      };
    }
    return null;
  }

  /**
   * 解析交易摘要
   */
  private parseTxSummary(txMap: any): import("./types").TxSummary {
    return {
      txId: txMap.txId || "",
      blockHash: txMap.blockHash || "",
      blockHeight: txMap.blockHeight || 0,
      timestamp: txMap.timestamp || 0,
    };
  }
}

/**
 * 映射资源类型
 */
function mapResourceType(type: "contract" | "model" | "static"): "static" | "contract" | "aimodel" {
  switch (type) {
    case "contract":
      return "contract";
    case "model":
      return "aimodel";
    case "static":
    default:
      return "static";
  }
}
