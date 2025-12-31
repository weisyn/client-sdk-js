/**
 * WESClient 类型化 API
 *
 * 提供强类型的 WES 节点客户端接口，封装核心 RPC 调用
 * 基于 _dev/CLIENT_API_DESIGN.md 设计
 */

import { IClient } from "./client";
import { NetworkError, JSONRPCError } from "./errors";
import {
  OutPoint,
  UTXO,
  ResourceInfo,
  ResourceFilters,
  TransactionInfo,
  TransactionFilters,
  EventInfo,
  EventFilters,
  NodeInfo,
  Transaction,
  SubmitTxResult,
  EventSubscription,
  // 新增类型
  BlockInfo,
  TransactionReceipt,
  FeeEstimate,
  SyncStatus,
  TokenBalance,
  AIModelCallRequest,
  AIModelCallResult,
} from "./wesclient-types";
import { batchGetResourcesSimple } from "../utils/batch_helpers";
import { addressBytesToBase58 } from "../utils/address";

/**
 * WESClient 错误码
 */
export type WESClientErrorCode =
  | "NETWORK_ERROR"
  | "RPC_ERROR"
  | "INVALID_PARAMS"
  | "RPC_NOT_IMPLEMENTED"
  | "NOT_FOUND"
  | "DECODE_FAILED";

/**
 * WESClient 错误类
 */
export class WESClientError extends Error {
  constructor(
    public code: WESClientErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "WESClientError";
  }
}

/**
 * WESClient 接口
 *
 * 提供类型化的 RPC 封装，避免直接使用 call(method, params)
 */
export interface WESClient {
  // UTXO 操作（地址模型，与节点 API 对齐）
  listUTXOs(address: Uint8Array): Promise<UTXO[]>;
  // 通过 OutPoint 获取单个 UTXO（通过地址查询后过滤）
  getUTXO(outPoint: OutPoint): Promise<UTXO | null>;

  // 资源操作（封装）
  getResource(resourceId: Uint8Array): Promise<ResourceInfo>;
  getResources(filters: ResourceFilters): Promise<ResourceInfo[]>;

  // 交易操作
  getTransaction(txId: string): Promise<TransactionInfo>;
  getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>;
  submitTransaction(tx: Transaction): Promise<SubmitTxResult>;

  // 事件操作
  getEvents(filters: EventFilters): Promise<EventInfo[]>;
  subscribeEvents(filters: EventFilters): Promise<EventSubscription>;

  // 节点信息
  getNodeInfo(): Promise<NodeInfo>;

  // 批量能力（利用 utils/batch 封装）
  supportsBatchQuery: boolean;
  batchGetResources(resourceIds: Uint8Array[]): Promise<ResourceInfo[]>;

  // 底层通道（不推荐上层直接使用）
  call(method: string, params: any): Promise<any>;

  // 连接管理
  close(): Promise<void>;

  // ========== 新增 API 方法 ==========

  // 区块查询
  getBlockByHeight(height: number, fullTx?: boolean): Promise<BlockInfo | null>;
  getBlockByHash(hash: Uint8Array, fullTx?: boolean): Promise<BlockInfo | null>;

  // 交易收据
  getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null>;

  // 费用估算
  estimateFee(tx: Transaction): Promise<FeeEstimate>;

  // 同步状态
  getSyncStatus(): Promise<SyncStatus>;

  // 只读合约调用
  contractCall(
    contractHash: Uint8Array,
    method: string,
    params?: number[],
    payload?: Uint8Array
  ): Promise<Uint8Array>;

  // 订阅管理
  unsubscribe(subscriptionId: string): Promise<boolean>;

  // 合约代币余额
  getContractTokenBalance(
    address: Uint8Array,
    contractHash: Uint8Array,
    tokenId?: string
  ): Promise<TokenBalance>;

  // AI 模型推理
  callAIModel(request: AIModelCallRequest): Promise<AIModelCallResult>;
}

/**
 * 包装 RPC 错误为 WESClientError
 */
function wrapRPCError(method: string, err: unknown): Error {
  if (err instanceof NetworkError) {
    return new WESClientError("NETWORK_ERROR", `network error calling ${method}`, err);
  }
  if (err instanceof JSONRPCError) {
    switch (err.rpcCode) {
      case -32602: // INVALID_PARAMS
        return new WESClientError("INVALID_PARAMS", err.message, err);
      case -32601: // METHOD_NOT_FOUND
        return new WESClientError("RPC_NOT_IMPLEMENTED", err.message, err);
      case -32000: // RPC_NOT_IMPLEMENTED (custom)
        return new WESClientError("RPC_NOT_IMPLEMENTED", err.message, err);
      default:
        return new WESClientError("RPC_ERROR", err.message, err);
    }
  }
  return err as Error;
}

/**
 * WESClientImpl 实现类
 */
export class WESClientImpl implements WESClient {
  public supportsBatchQuery = false; // 当前节点不支持批量 RPC，使用并发模拟

  constructor(private readonly client: IClient) {}

  /**
   * 通过地址查询所有 UTXO
   *
   * 这是节点 API wes_getUTXO 的原生用法，直接匹配节点 API 设计
   * 节点 API: wes_getUTXO(address: string) -> { utxos: [...] }
   */
  async listUTXOs(address: Uint8Array): Promise<UTXO[]> {
    try {
      // 将地址转换为 Base58 格式
      const addressBase58 = addressBytesToBase58(address);

      // 调用节点 API wes_getUTXO(address)
      const raw = await this.client.call("wes_getUTXO", [addressBase58]);

      // 解析返回的 UTXO 列表
      if (!raw || typeof raw !== "object") {
        throw new WESClientError("DECODE_FAILED", "Invalid UTXO response format");
      }

      // 节点返回格式：{ utxos: [...] }
      const utxosArray = (raw as any).utxos || [];
      if (!Array.isArray(utxosArray)) {
        throw new WESClientError(
          "DECODE_FAILED",
          "Invalid UTXO response format: expected utxos array"
        );
      }

      // 解码每个 UTXO
      return utxosArray.map((item: any) => decodeUTXO(item));
    } catch (err) {
      throw wrapRPCError("wes_getUTXO", err);
    }
  }

  /**
   * 通过 OutPoint 获取单个 UTXO
   *
   * 注意：节点 API 只支持通过地址查询所有 UTXO，因此此方法需要：
   * 1. 先通过交易 ID 查询交易信息获取输出地址
   * 2. 然后通过地址查询所有 UTXO
   * 3. 最后过滤出匹配的 UTXO
   *
   * 如果无法确定地址，则返回 null
   */
  async getUTXO(outPoint: OutPoint): Promise<UTXO | null> {
    try {
      // 先获取交易信息以确定输出地址
      const tx = await this.getTransaction(outPoint.txId);

      // 检查输出索引是否有效
      if (!tx.outputs || outPoint.outputIndex >= tx.outputs.length) {
        return null;
      }

      const output = tx.outputs[outPoint.outputIndex];
      if (!output || typeof output !== "object") {
        return null;
      }

      // 尝试从输出中获取地址（需要根据实际协议调整）
      // 如果输出中没有地址信息，无法通过地址查询，返回 null
      // 这是一个限制：节点 API 只支持通过地址查询 UTXO
      const outputObj = output as any;
      const addressHex = outputObj.address || outputObj.owner;

      if (!addressHex) {
        // 无法确定地址，返回 null
        return null;
      }

      // 将地址转换为 Uint8Array
      let addressBytes: Uint8Array;
      if (typeof addressHex === "string") {
        // 移除 0x 前缀（如果有）
        const hex = addressHex.startsWith("0x") ? addressHex.slice(2) : addressHex;
        addressBytes = new Uint8Array(
          hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
        );
      } else if (addressHex instanceof Uint8Array) {
        addressBytes = addressHex;
      } else {
        return null;
      }

      // 查询该地址的所有 UTXO
      const utxos = await this.listUTXOs(addressBytes);

      // 查找匹配的 UTXO
      const matchedUTXO = utxos.find(
        (utxo) =>
          utxo.outPoint.txId === outPoint.txId && utxo.outPoint.outputIndex === outPoint.outputIndex
      );

      return matchedUTXO || null;
    } catch (err) {
      // 如果查询失败，返回 null 而不是抛出错误
      // 这样调用者可以处理"未找到"的情况
      return null;
    }
  }

  async getResource(resourceId: Uint8Array): Promise<ResourceInfo> {
    try {
      // 将 resourceId 转换为 hex 字符串
      const resourceIdHex = Array.from(resourceId)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 使用 wes_getResource(resourceId) 而不是 wes_getResourceByContentHash
      const raw = await this.client.call("wes_getResource", [`0x${resourceIdHex}`]);
      return decodeResourceInfo(raw);
    } catch (err) {
      throw wrapRPCError("wes_getResource", err);
    }
  }

  async getResources(filters: ResourceFilters): Promise<ResourceInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceType) req.resourceType = filters.resourceType;
      if (filters.owner) {
        // 将 owner 转换为 hex 字符串
        req.owner = `0x${Array.from(filters.owner)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // ✅ 已迁移到 wes_listResources（基于 UTXO 视图）
      // 参数格式：[{ filters: { resourceType, owner, limit, offset } }]
      const raw = await this.client.call("wes_listResources", [{ filters: req }]);
      const wire = decodeResourceArray(raw);
      return wire.map(mapWireResourceToDomain);
    } catch (err) {
      // 如果 RPC 不存在，返回空数组（或抛出错误，取决于设计）
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError("wes_listResources", err);
      }
      throw wrapRPCError("wes_listResources", err);
    }
  }

  async getTransaction(txId: string): Promise<TransactionInfo> {
    try {
      const params = { txId };
      const raw = await this.client.call("wes_getTransactionByHash", [params]);
      return decodeTransactionInfo(raw);
    } catch (err) {
      throw wrapRPCError("wes_getTransactionByHash", err);
    }
  }

  async getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      if (filters.txId) req.txId = filters.txId;
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // 注意：当前节点可能没有 wes_getTransactionHistory，需要根据实际 RPC 调整
      const raw = await this.client.call("wes_getTransactionHistory", [{ filters: req }]);
      const wire = decodeTransactionArray(raw);
      return wire.map(mapWireTransactionToDomain);
    } catch (err) {
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError("wes_getTransactionHistory", err);
      }
      throw wrapRPCError("wes_getTransactionHistory", err);
    }
  }

  async submitTransaction(tx: Transaction): Promise<SubmitTxResult> {
    try {
      // 将交易序列化为 hex 字符串
      const txHex = encodeTransaction(tx);
      const result = await this.client.sendRawTransaction(txHex);
      return {
        txHash: result.txHash,
        accepted: result.accepted,
        reason: result.reason,
      };
    } catch (err) {
      throw wrapRPCError("wes_sendRawTransaction", err);
    }
  }

  async getEvents(filters: EventFilters): Promise<EventInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      if (filters.eventName) req.eventName = filters.eventName;
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // 注意：当前节点可能没有 wes_getEvents，需要根据实际 RPC 调整
      const raw = await this.client.call("wes_getEvents", [{ filters: req }]);
      const wire = decodeEventArray(raw);
      return wire.map(mapWireEventToDomain);
    } catch (err) {
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError("wes_getEvents", err);
      }
      throw wrapRPCError("wes_getEvents", err);
    }
  }

  async subscribeEvents(filters: EventFilters): Promise<EventSubscription> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      if (filters.eventName) req.eventName = filters.eventName;

      // 使用 WebSocket 订阅
      // IClient.subscribe 返回的 EventSubscription 与 WESClient 的 EventSubscription 兼容
      return (await this.client.subscribe(req)) as EventSubscription;
    } catch (err) {
      throw wrapRPCError("wes_subscribeEvents", err);
    }
  }

  async getNodeInfo(): Promise<NodeInfo> {
    try {
      // 组合多个 RPC 调用获取节点信息
      const [chainId, blockNumber] = await Promise.all([
        this.client.call("wes_chainId", []),
        this.client.call("wes_blockNumber", []),
      ]);

      return {
        rpcVersion: "1.0.0", // TODO: 从节点获取实际版本
        chainId: typeof chainId === "string" ? chainId : "0x1",
        blockHeight:
          typeof blockNumber === "string"
            ? parseInt(blockNumber, 16)
            : typeof blockNumber === "number"
              ? blockNumber
              : 0,
      };
    } catch (err) {
      throw wrapRPCError("wes_getNodeInfo", err);
    }
  }

  async batchGetResources(resourceIds: Uint8Array[]): Promise<ResourceInfo[]> {
    // 使用 utils/batch 进行可控并发的批量查询
    return batchGetResourcesSimple(this, resourceIds);
  }

  async call(method: string, params: any): Promise<any> {
    return this.client.call(method, params);
  }

  async close(): Promise<void> {
    return this.client.close();
  }

  // ========== 新增 API 方法实现 ==========

  /**
   * 按高度查询区块
   */
  async getBlockByHeight(height: number, fullTx = false): Promise<BlockInfo | null> {
    try {
      const params = [`0x${height.toString(16)}`, fullTx];
      const raw = await this.client.call("wes_getBlockByHeight", params);

      if (!raw) {
        return null;
      }

      return decodeBlockInfo(raw, fullTx);
    } catch (err) {
      throw wrapRPCError("wes_getBlockByHeight", err);
    }
  }

  /**
   * 按哈希查询区块
   */
  async getBlockByHash(hash: Uint8Array, fullTx = false): Promise<BlockInfo | null> {
    if (hash.length !== 32) {
      throw new WESClientError("INVALID_PARAMS", "block hash must be 32 bytes");
    }

    try {
      const hashHex = `0x${bytesToHex(hash)}`;
      const params = [hashHex, fullTx];
      const raw = await this.client.call("wes_getBlockByHash", params);

      if (!raw) {
        return null;
      }

      return decodeBlockInfo(raw, fullTx);
    } catch (err) {
      throw wrapRPCError("wes_getBlockByHash", err);
    }
  }

  /**
   * 获取交易收据
   */
  async getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null> {
    if (!txHash) {
      throw new WESClientError("INVALID_PARAMS", "transaction hash is required");
    }

    try {
      const hash = txHash.startsWith("0x") ? txHash : `0x${txHash}`;
      const raw = await this.client.call("wes_getTransactionReceipt", [hash]);

      if (!raw) {
        return null;
      }

      return decodeTransactionReceipt(raw);
    } catch (err) {
      throw wrapRPCError("wes_getTransactionReceipt", err);
    }
  }

  /**
   * 估算交易费用
   */
  async estimateFee(tx: Transaction): Promise<FeeEstimate> {
    try {
      // 节点端 wes_estimateFee 要求 params[0] 为“交易草稿对象”，不是已签名 hex
      if (typeof tx === "string") {
        throw new WESClientError(
          "INVALID_PARAMS",
          "wes_estimateFee expects a transaction draft object, not signed tx hex string"
        );
      }

      const raw = await this.client.call("wes_estimateFee", [tx]);
      return decodeFeeEstimate(raw);
    } catch (err) {
      throw wrapRPCError("wes_estimateFee", err);
    }
  }

  /**
   * 获取节点同步状态
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const raw = await this.client.call("wes_syncing", []);

      // 如果返回 false，表示已同步
      if (raw === false) {
        return {
          syncing: false,
          currentHeight: 0,
          highestHeight: 0,
          startingBlock: 0,
          progress: 1.0,
        };
      }

      return decodeSyncStatus(raw);
    } catch (err) {
      throw wrapRPCError("wes_syncing", err);
    }
  }

  /**
   * 只读合约调用
   */
  async contractCall(
    contractHash: Uint8Array,
    method: string,
    params?: number[],
    payload?: Uint8Array
  ): Promise<Uint8Array> {
    if (contractHash.length !== 32) {
      throw new WESClientError("INVALID_PARAMS", "contract hash must be 32 bytes");
    }

    if (!method) {
      throw new WESClientError("INVALID_PARAMS", "method name is required");
    }

    try {
      // 节点端只解析 callData.data（支持 JSON string / 0xhex(json bytes) / 直接方法名）
      // 为了携带 params/payload，这里统一用 JSON string 形式：{"method":"...","params":[...],"payload":"0x..."}
      const spec: any = { method };
      if (params && params.length > 0) {
        spec.params = params;
      }
      if (payload && payload.length > 0) {
        spec.payload = `0x${bytesToHex(payload)}`;
      }

      const callData: any = {
        to: `0x${bytesToHex(contractHash)}`,
        data: JSON.stringify(spec),
      };

      const raw = await this.client.call("wes_call", [callData]);

      if (!raw || typeof raw !== "object") {
        return new Uint8Array(0);
      }

      const resultMap = raw as any;
      const returnData = resultMap.return_data || resultMap.returnData || "";

      if (returnData) {
        return hexStringToBytes(returnData);
      }

      return new Uint8Array(0);
    } catch (err) {
      throw wrapRPCError("wes_call", err);
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    if (!subscriptionId) {
      throw new WESClientError("INVALID_PARAMS", "subscription ID is required");
    }

    try {
      const raw = await this.client.call("wes_unsubscribe", [subscriptionId]);
      return raw === true;
    } catch (err) {
      throw wrapRPCError("wes_unsubscribe", err);
    }
  }

  /**
   * 查询合约代币余额
   */
  async getContractTokenBalance(
    address: Uint8Array,
    contractHash: Uint8Array,
    tokenId?: string
  ): Promise<TokenBalance> {
    if (address.length !== 20) {
      throw new WESClientError("INVALID_PARAMS", "address must be 20 bytes");
    }

    if (contractHash.length !== 32) {
      throw new WESClientError("INVALID_PARAMS", "contract hash must be 32 bytes");
    }

    try {
      const addressBase58 = addressBytesToBase58(address);
      const reqParams: any = {
        address: addressBase58,
        content_hash: bytesToHex(contractHash),
      };

      if (tokenId) {
        reqParams.token_id = tokenId;
      }

      const raw = await this.client.call("wes_getContractTokenBalance", [reqParams]);
      return decodeTokenBalance(raw);
    } catch (err) {
      throw wrapRPCError("wes_getContractTokenBalance", err);
    }
  }

  /**
   * 调用 AI 模型
   */
  async callAIModel(request: AIModelCallRequest): Promise<AIModelCallResult> {
    if (!request) {
      throw new WESClientError("INVALID_PARAMS", "request is required");
    }

    if (request.modelHash.length !== 32) {
      throw new WESClientError("INVALID_PARAMS", "model hash must be 32 bytes");
    }
    if (!Array.isArray(request.inputs) || request.inputs.length === 0) {
      throw new WESClientError("INVALID_PARAMS", "inputs is required and cannot be empty");
    }

    try {
      const returnUnsignedTx = request.returnUnsignedTx === true;
      if (!returnUnsignedTx && !request.privateKey) {
        throw new WESClientError(
          "INVALID_PARAMS",
          "private_key is required when return_unsigned_tx is false"
        );
      }

      const reqParams: any = {
        model_hash: `0x${bytesToHex(request.modelHash)}`,
        inputs: request.inputs,
        return_unsigned_tx: returnUnsignedTx,
      };

      if (request.privateKey) {
        reqParams.private_key = request.privateKey;
      }
      if (request.paymentToken) {
        reqParams.payment_token = request.paymentToken;
      }

      const raw = await this.client.call("wes_callAIModel", [reqParams]);
      return decodeAIModelCallResult(raw);
    } catch (err) {
      throw wrapRPCError("wes_callAIModel", err);
    }
  }
}

// ========== 解码函数 ==========

/**
 * 解码 UTXO
 *
 * 支持两种格式：
 * 1. 直接 UTXO 对象：{ outpoint: "txhash:index", amount: ..., ... }
 * 2. 标准格式：{ txId, outputIndex, output, lockingCondition }
 */
function decodeUTXO(raw: any): UTXO {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid UTXO response format");
  }

  // 如果包含 outpoint 字符串（格式：txhash:index）
  if (raw.outpoint && typeof raw.outpoint === "string") {
    const [txId, indexStr] = raw.outpoint.split(":");
    const outputIndex = parseInt(indexStr, 10) || 0;

    return {
      outPoint: {
        txId: txId.startsWith("0x") ? txId : `0x${txId}`,
        outputIndex,
      },
      output: {
        amount: raw.amount || "0",
        tokenID: raw.tokenID || raw.token_id,
        contractAddress: raw.contractAddress || raw.contract_address,
        height: raw.height || "0x0",
      },
      lockingCondition: raw.lockingCondition || raw.locking_condition || {},
    } as UTXO;
  }

  // 标准格式
  return {
    outPoint: {
      txId: raw.txId || raw.tx_id || "",
      outputIndex: raw.outputIndex ?? raw.output_index ?? 0,
    },
    output: raw.output || {},
    lockingCondition: raw.lockingCondition || raw.locking_condition || {},
  } as UTXO;
}

/**
 * 解码资源数组
 */
function decodeResourceArray(raw: any): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && Array.isArray(raw.resources)) {
    return raw.resources;
  }
  return [];
}

/**
 * 映射 wire 资源到域模型
 *
 * 支持节点返回的资源格式：
 * - content_hash: hex 字符串
 * - category: 'CONTRACT' | 'MODEL' | 'STATIC'
 * - executable_type: 'WASM' | 'ONNX' | ...
 * - created_timestamp: uint64
 */
function mapWireResourceToDomain(w: any): ResourceInfo {
  // 解析 resourceId（优先使用 content_hash）
  const contentHashStr = w.contentHash || w.content_hash || "0x00";
  const resourceIdBytes = hexStringToBytes(contentHashStr);

  // 解析 resourceType（优先使用 WES 标准字段 resourceType）
  // WES buildResourceMetadata 已经提供了标准化的 resourceType 字段：'contract' | 'model' | 'static'
  const typeSource = w.resourceType || w.resource_type || w.category || w.resource_category;
  const resourceType = mapResourceType(typeof typeSource === "string" ? typeSource : "static");

  // 解析 createdAt（支持多种格式）
  let createdAt: Date;
  if (w.createdAt) {
    createdAt = new Date(w.createdAt);
  } else if (w.createdTimestamp) {
    // uint64 时间戳（秒级）
    const ts =
      typeof w.createdTimestamp === "string"
        ? parseInt(w.createdTimestamp, 10)
        : w.createdTimestamp;
    createdAt = new Date(ts * 1000);
  } else {
    createdAt = new Date();
  }

  // 提取元数据字段（严格来自链上，不推导）
  const name = typeof w.name === "string" && w.name.trim() !== "" ? w.name : undefined;
  const version = typeof w.version === "string" && w.version.trim() !== "" ? w.version : undefined;
  const description =
    typeof w.description === "string" && w.description.trim() !== "" ? w.description : undefined;
  const creatorAddress =
    typeof w.creator_address === "string" && w.creator_address.trim() !== ""
      ? w.creator_address
      : typeof w.creatorAddress === "string" && w.creatorAddress.trim() !== ""
        ? w.creatorAddress
        : undefined;

  // 提取 tags（从 custom_attributes 或 metadata.tags）
  let tags: string[] | undefined;
  if (Array.isArray(w.tags)) {
    tags = w.tags.filter((t: any) => typeof t === "string" && t.trim() !== "");
  } else if (w.custom_attributes && typeof w.custom_attributes === "object") {
    // 尝试从 custom_attributes 中提取 tags
    if (Array.isArray(w.custom_attributes.tags)) {
      tags = w.custom_attributes.tags.filter((t: any) => typeof t === "string" && t.trim() !== "");
    }
  }
  if (tags && tags.length === 0) {
    tags = undefined;
  }

  // 提取 custom_attributes（如果存在）
  const customAttributes =
    w.custom_attributes && typeof w.custom_attributes === "object"
      ? w.custom_attributes
      : undefined;

  return {
    resourceId: resourceIdBytes,
    resourceType,
    contentHash: hexStringToBytes(contentHashStr),
    size: w.size || 0,
    mimeType: w.mimeType || w.mime_type,
    lockingConditions: w.lockingConditions || w.locking_conditions || [],
    createdAt,
    // 元数据字段（严格来自链上）
    name,
    version,
    description,
    creatorAddress,
    tags,
    customAttributes,
  };
}

/**
 * 解码资源信息
 */
function decodeResourceInfo(raw: any): ResourceInfo {
  return mapWireResourceToDomain(raw);
}

/**
 * 解码交易数组
 */
function decodeTransactionArray(raw: any): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && Array.isArray(raw.transactions)) {
    return raw.transactions;
  }
  return [];
}

/**
 * 映射 wire 交易到域模型
 *
 * 支持两种格式：
 * 1. protojson 格式：包含完整的 inputs, outputs, hash, blockHeight 等
 * 2. 简化格式：只包含基本字段
 */
function mapWireTransactionToDomain(w: any): TransactionInfo {
  // 解析 blockHeight（可能是 hex 字符串或数字）
  let blockHeight: number | undefined;
  if (w.blockHeight !== undefined && w.blockHeight !== null) {
    if (typeof w.blockHeight === "string") {
      // hex 字符串格式 "0x1234"
      const cleanHex = w.blockHeight.startsWith("0x") ? w.blockHeight.slice(2) : w.blockHeight;
      blockHeight = parseInt(cleanHex, 16);
    } else if (typeof w.blockHeight === "number") {
      blockHeight = w.blockHeight;
    }
  }

  // 解析 timestamp（可能是多种格式）
  let timestamp: Date;
  if (w.timestamp) {
    if (typeof w.timestamp === "string") {
      timestamp = new Date(w.timestamp);
    } else if (typeof w.timestamp === "number") {
      timestamp = new Date(w.timestamp);
    } else {
      timestamp = new Date();
    }
  } else if (w.creationTimestamp) {
    // 使用 creationTimestamp（可能是 uint64）
    const ts =
      typeof w.creationTimestamp === "string"
        ? parseInt(w.creationTimestamp, 10)
        : w.creationTimestamp;
    timestamp = new Date(ts * 1000); // 假设是秒级时间戳
  } else {
    timestamp = new Date();
  }

  // 确定交易 ID（hash 字段优先）
  const txId = w.hash || w.txId || w.tx_id || w.txHash || w.tx_hash || "";

  // 确定状态（根据 blockHeight 判断）
  let status: "pending" | "confirmed" | "failed" = "pending";
  if (w.status) {
    status = mapTransactionStatus(w.status);
  } else if (blockHeight !== undefined && blockHeight > 0) {
    status = "confirmed";
  }

  return {
    txId,
    status,
    inputs: w.inputs || [],
    outputs: w.outputs || [],
    blockHeight,
    timestamp,
  };
}

/**
 * 解码交易信息
 */
function decodeTransactionInfo(raw: any): TransactionInfo {
  return mapWireTransactionToDomain(raw);
}

/**
 * 解码事件数组
 */
function decodeEventArray(raw: any): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && Array.isArray(raw.events)) {
    return raw.events;
  }
  return [];
}

/**
 * 映射 wire 事件到域模型
 */
function mapWireEventToDomain(w: any): EventInfo {
  // 解析 blockHeight（可能是 hex 字符串或数字）
  let blockHeight: number | undefined;
  if (w.blockHeight !== undefined && w.blockHeight !== null) {
    if (typeof w.blockHeight === "string") {
      const cleanHex = w.blockHeight.startsWith("0x") ? w.blockHeight.slice(2) : w.blockHeight;
      blockHeight = parseInt(cleanHex, 16);
    } else if (typeof w.blockHeight === "number") {
      blockHeight = w.blockHeight;
    }
  }

  // 解析 timestamp
  let timestamp: Date;
  if (w.timestamp) {
    if (typeof w.timestamp === "string") {
      timestamp = new Date(w.timestamp);
    } else if (typeof w.timestamp === "number") {
      timestamp = new Date(w.timestamp);
    } else {
      timestamp = new Date();
    }
  } else {
    timestamp = new Date();
  }

  return {
    eventName: w.eventName || w.event_name || "",
    resourceId: hexStringToBytes(w.resourceId || w.resource_id || "0x00"),
    data: hexStringToBytes(w.data || "0x00"),
    txId: w.txId || w.tx_id || w.txHash || w.tx_hash || "",
    blockHeight,
    timestamp,
  };
}

/**
 * 编码交易为 hex 字符串
 *
 * 支持两种格式：
 * 1. 字符串格式：直接返回（假设已经是序列化的 hex 字符串）
 * 2. 对象格式：需要序列化（当前不支持，需要 protobuf 库）
 */
function encodeTransaction(tx: Transaction): string {
  if (typeof tx === "string") {
    // 已经是 hex 字符串
    return tx.startsWith("0x") ? tx : `0x${tx}`;
  }

  if (typeof tx === "object" && tx !== null) {
    // TODO: 如果未来需要支持对象格式，需要使用 protobuf 序列化
    // 当前节点 API 期望的是已签名的交易 hex 字符串
    // 交易构建和签名应该在 SDK 的上层完成（如 TransactionBuilder）
    throw new WESClientError(
      "DECODE_FAILED",
      "Transaction object encoding not supported. Please provide a signed transaction hex string."
    );
  }

  throw new WESClientError("DECODE_FAILED", "Invalid transaction format");
}

/**
 * 映射资源类型
 *
 * 优先支持 WES 标准字段值：'contract' | 'model' | 'static'
 * 对于 category 字段（如 'RESOURCE_CATEGORY_EXECUTABLE'）作为兜底处理
 */
function mapResourceType(type: string): "contract" | "model" | "static" {
  const t = type.toLowerCase().trim();

  // WES 标准 resourceType 值（优先）
  if (t === "contract") return "contract";
  if (t === "model" || t === "aimodel") return "model";
  if (t === "static" || t === "file") return "static";

  // 对于 category 字段的兜底处理（EXECUTABLE -> contract，其他 -> static）
  if (t.includes("executable")) return "contract";

  // 默认返回 static
  return "static";
}

/**
 * 映射交易状态
 */
function mapTransactionStatus(status: string): "pending" | "confirmed" | "failed" {
  switch (status) {
    case "confirmed":
    case "success":
      return "confirmed";
    case "failed":
      return "failed";
    case "pending":
    default:
      return "pending";
  }
}

/**
 * 将 hex 字符串转换为 Uint8Array
 */
function hexStringToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * 将 Uint8Array 转换为 hex 字符串（不含 0x 前缀）
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ========== 新增解码函数 ==========

/**
 * 解码区块信息
 */
function decodeBlockInfo(raw: any, fullTx: boolean): BlockInfo {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid block response format");
  }

  const block: BlockInfo = {
    height: 0,
    hash: new Uint8Array(32),
    parentHash: new Uint8Array(32),
    timestamp: new Date(),
    stateRoot: new Uint8Array(32),
    difficulty: "",
    miner: "",
    size: 0,
    txHashes: [],
    transactions: [],
    txCount: 0,
  };

  // 解析高度
  if (typeof raw.height === "number") {
    block.height = raw.height;
  } else if (typeof raw.height === "string") {
    const cleanHex = raw.height.startsWith("0x") ? raw.height.slice(2) : raw.height;
    block.height = parseInt(cleanHex, 16) || 0;
  }

  // 解析哈希
  const hashStr = raw.hash || raw.block_hash || "";
  if (hashStr) {
    block.hash = hexStringToBytes(hashStr);
  }

  // 解析父哈希
  const parentHashStr = raw.parent_hash || raw.parentHash || "";
  if (parentHashStr) {
    block.parentHash = hexStringToBytes(parentHashStr);
  }

  // 解析时间戳
  if (typeof raw.timestamp === "string") {
    block.timestamp = new Date(raw.timestamp);
  } else if (typeof raw.timestamp === "number") {
    block.timestamp = new Date(raw.timestamp * 1000);
  }

  // 解析状态根
  const stateRootStr = raw.state_root || raw.stateRoot || "";
  if (stateRootStr) {
    block.stateRoot = hexStringToBytes(stateRootStr);
  }

  // 解析难度
  if (raw.difficulty) {
    block.difficulty = String(raw.difficulty);
  }

  // 解析矿工
  if (raw.miner) {
    block.miner = raw.miner;
  }

  // 解析大小
  if (typeof raw.size === "number") {
    block.size = raw.size;
  }

  // 解析交易数量
  if (typeof raw.tx_count === "number") {
    block.txCount = raw.tx_count;
  }

  // 解析交易列表
  if (fullTx && Array.isArray(raw.transactions)) {
    block.transactions = raw.transactions.map((tx: any) => mapWireTransactionToDomain(tx));
    block.txCount = block.transactions.length;
  } else if (Array.isArray(raw.tx_hashes)) {
    block.txHashes = raw.tx_hashes.filter((h: any) => typeof h === "string");
    block.txCount = block.txHashes.length;
  }

  return block;
}

/**
 * 解码交易收据
 */
function decodeTransactionReceipt(raw: any): TransactionReceipt {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid transaction receipt format");
  }

  const receipt: TransactionReceipt = {
    txHash: "",
    txIndex: 0,
    blockHeight: 0,
    blockHash: new Uint8Array(32),
    status: "0x0",
  };

  // 节点真实返回字段（internal/api/jsonrpc/methods/tx.go）：
  // tx_hash, tx_index, block_height, block_hash, status("0x1"/"0x0"), state_root, timestamp, execution_result_hash, statusReason

  receipt.txHash = raw.tx_hash || "";

  if (typeof raw.tx_index === "number") {
    receipt.txIndex = raw.tx_index;
  }

  // block_height
  if (typeof raw.block_height === "number") {
    receipt.blockHeight = raw.block_height;
  } else if (typeof raw.block_height === "string") {
    const cleanHex = raw.block_height.startsWith("0x")
      ? raw.block_height.slice(2)
      : raw.block_height;
    receipt.blockHeight = parseInt(cleanHex, 16) || 0;
  }

  // block_hash
  const blockHashStr = raw.block_hash || "";
  if (blockHashStr) {
    receipt.blockHash = hexStringToBytes(blockHashStr);
  }

  // status
  if (raw.status === "0x1" || raw.status === "0x0") {
    receipt.status = raw.status;
  }
  if (typeof raw.statusReason === "string") {
    receipt.statusReason = raw.statusReason;
  }
  if (typeof raw.execution_result_hash === "string" && raw.execution_result_hash) {
    receipt.executionResultHash = hexStringToBytes(raw.execution_result_hash);
  }
  if (typeof raw.state_root === "string" && raw.state_root) {
    receipt.stateRoot = hexStringToBytes(raw.state_root);
  }
  if (typeof raw.timestamp === "number") {
    receipt.timestamp = raw.timestamp;
  }

  return receipt;
}

/**
 * 解码费用估算结果
 */
function decodeFeeEstimate(raw: any): FeeEstimate {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid fee estimate format");
  }

  const fee: FeeEstimate = {
    estimatedFee: BigInt(0),
    feeRate: "",
    numInputs: 0,
    numOutputs: 0,
  };

  // 节点真实返回字段：estimated_fee, fee_rate, num_inputs, num_outputs
  if (typeof raw.estimated_fee === "number") {
    fee.estimatedFee = BigInt(raw.estimated_fee);
  }
  if (typeof raw.fee_rate === "string") {
    fee.feeRate = raw.fee_rate;
  }
  if (typeof raw.num_inputs === "number") {
    fee.numInputs = raw.num_inputs;
  }
  if (typeof raw.num_outputs === "number") {
    fee.numOutputs = raw.num_outputs;
  }

  return fee;
}

/**
 * 解码同步状态
 */
function decodeSyncStatus(raw: any): SyncStatus {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid sync status format");
  }

  const status: SyncStatus = {
    syncing: true,
    currentHeight: 0,
    highestHeight: 0,
    startingBlock: 0,
    progress: 0,
  };

  // 解析起始区块
  if (typeof raw.startingBlock === "string") {
    const cleanHex = raw.startingBlock.startsWith("0x")
      ? raw.startingBlock.slice(2)
      : raw.startingBlock;
    status.startingBlock = parseInt(cleanHex, 16) || 0;
  }

  // 解析当前区块
  if (typeof raw.currentBlock === "string") {
    const cleanHex = raw.currentBlock.startsWith("0x")
      ? raw.currentBlock.slice(2)
      : raw.currentBlock;
    status.currentHeight = parseInt(cleanHex, 16) || 0;
  }

  // 解析最高区块
  if (typeof raw.highestBlock === "string") {
    const cleanHex = raw.highestBlock.startsWith("0x")
      ? raw.highestBlock.slice(2)
      : raw.highestBlock;
    status.highestHeight = parseInt(cleanHex, 16) || 0;
  }

  // 计算进度
  if (status.highestHeight > 0) {
    status.progress = status.currentHeight / status.highestHeight;
  }

  return status;
}

/**
 * 解码代币余额
 */
function decodeTokenBalance(raw: any): TokenBalance {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid token balance format");
  }

  const balance: TokenBalance = {
    address: "",
    contractHash: "",
    contractAddress: "",
    tokenId: "",
    balance: "0",
    utxoCount: 0,
    height: 0,
  };

  // 解析地址
  if (raw.address) {
    balance.address = raw.address;
  }

  // 解析合约哈希
  if (raw.content_hash) {
    balance.contractHash = raw.content_hash;
  }

  // 解析合约地址
  if (raw.contract_address) {
    balance.contractAddress = raw.contract_address;
  }

  // 解析代币 ID
  if (raw.token_id) {
    balance.tokenId = raw.token_id;
  }

  // 解析余额
  if (raw.balance) {
    balance.balance = raw.balance;
  }

  // 解析余额（bigint 格式）
  if (typeof raw.balance_uint64 === "number") {
    balance.balanceUint64 = BigInt(raw.balance_uint64);
  }

  // 解析 UTXO 数量
  if (typeof raw.utxo_count === "number") {
    balance.utxoCount = raw.utxo_count;
  }

  // 解析区块高度
  if (typeof raw.height === "number") {
    balance.height = raw.height;
  }

  return balance;
}

/**
 * 解码 AI 模型调用结果
 */
function decodeAIModelCallResult(raw: any): AIModelCallResult {
  if (!raw || typeof raw !== "object") {
    throw new WESClientError("DECODE_FAILED", "Invalid AI model call result format");
  }

  const result: AIModelCallResult = {
    success: false,
  };

  // 解析成功标志
  if (typeof raw.success === "boolean") {
    result.success = raw.success;
  }

  if (typeof raw.tx_hash === "string") {
    result.txHash = raw.tx_hash;
  }
  if (typeof raw.unsigned_tx === "string") {
    result.unsignedTx = raw.unsigned_tx;
  }
  if (raw.outputs !== undefined) {
    result.outputs = raw.outputs;
  }
  if (typeof raw.message === "string") {
    result.message = raw.message;
  }
  if (raw.compute_info !== undefined) {
    result.computeInfo = raw.compute_info;
  }

  return result;
}
