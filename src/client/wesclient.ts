/**
 * WESClient 类型化 API
 * 
 * 提供强类型的 WES 节点客户端接口，封装核心 RPC 调用
 * 基于 _dev/CLIENT_API_DESIGN.md 设计
 */

import { IClient } from './client';
import { NetworkError, JSONRPCError } from './errors';
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
} from './wesclient-types';
import { batchGetUTXOsSimple, batchGetResourcesSimple } from '../utils/batch_helpers';

/**
 * WESClient 错误码
 */
export type WESClientErrorCode =
  | 'NETWORK_ERROR'
  | 'RPC_ERROR'
  | 'INVALID_PARAMS'
  | 'RPC_NOT_IMPLEMENTED'
  | 'NOT_FOUND'
  | 'DECODE_FAILED';

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
    this.name = 'WESClientError';
  }
}

/**
 * WESClient 接口
 * 
 * 提供类型化的 RPC 封装，避免直接使用 call(method, params)
 */
export interface WESClient {
  // UTXO 操作
  getUTXO(outPoint: OutPoint): Promise<UTXO>;
  getUTXOs(outPoints: OutPoint[]): Promise<UTXO[]>;

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
  batchGetUTXOs(outPoints: OutPoint[]): Promise<UTXO[]>;
  batchGetResources(resourceIds: Uint8Array[]): Promise<ResourceInfo[]>;

  // 底层通道（不推荐上层直接使用）
  call(method: string, params: any): Promise<any>;

  // 连接管理
  close(): Promise<void>;
}

/**
 * 包装 RPC 错误为 WESClientError
 */
function wrapRPCError(method: string, err: unknown): Error {
  if (err instanceof NetworkError) {
    return new WESClientError('NETWORK_ERROR', `network error calling ${method}`, err);
  }
  if (err instanceof JSONRPCError) {
    switch (err.rpcCode) {
      case -32602: // INVALID_PARAMS
        return new WESClientError('INVALID_PARAMS', err.message, err);
      case -32601: // METHOD_NOT_FOUND
        return new WESClientError('RPC_NOT_IMPLEMENTED', err.message, err);
      case -32000: // RPC_NOT_IMPLEMENTED (custom)
        return new WESClientError('RPC_NOT_IMPLEMENTED', err.message, err);
      default:
        return new WESClientError('RPC_ERROR', err.message, err);
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

  async getUTXO(outPoint: OutPoint): Promise<UTXO> {
    try {
      // 注意：当前节点实现中，wes_getUTXO 接受地址参数，而不是 OutPoint
      // 这里我们假设未来会有支持 OutPoint 的 RPC，或者需要先通过其他方式获取
      // TODO: 根据实际节点 RPC 实现调整
      // 当前实现：尝试使用 outpoint 格式作为参数
      const params = { txId: outPoint.txId, outputIndex: outPoint.outputIndex };
      const raw = await this.client.call('wes_getUTXO', [params]);
      
      // 如果返回的是数组格式（多个 UTXO），取第一个匹配的
      if (Array.isArray(raw)) {
        const utxo = raw.find((u: any) => {
          const outpointStr = u.outpoint || '';
          const [txId, index] = outpointStr.split(':');
          return txId === outPoint.txId && parseInt(index) === outPoint.outputIndex;
        });
        if (utxo) {
          return decodeUTXO(utxo);
        }
      }
      
      // 如果返回的是对象格式
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        // 检查是否是 { utxos: [...] } 格式
        if ('utxos' in raw && Array.isArray(raw.utxos)) {
          const utxo = raw.utxos.find((u: any) => {
            const outpointStr = u.outpoint || '';
            const [txId, index] = outpointStr.split(':');
            return txId === outPoint.txId && parseInt(index) === outPoint.outputIndex;
          });
          if (utxo) {
            return decodeUTXO(utxo);
          }
        } else {
          // 直接是 UTXO 对象
          return decodeUTXO(raw);
        }
      }
      
      throw new WESClientError('NOT_FOUND', `UTXO not found: ${outPoint.txId}:${outPoint.outputIndex}`);
    } catch (err) {
      throw wrapRPCError('wes_getUTXO', err);
    }
  }

  async getUTXOs(outPoints: OutPoint[]): Promise<UTXO[]> {
    // 并发调用多个 getUTXO
    return Promise.all(outPoints.map((op) => this.getUTXO(op)));
  }

  async getResource(resourceId: Uint8Array): Promise<ResourceInfo> {
    try {
      // 将 resourceId 转换为 hex 字符串
      const resourceIdHex = Array.from(resourceId)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      
      const params = { resourceId: `0x${resourceIdHex}` };
      const raw = await this.client.call('wes_getResourceByContentHash', [params]);
      return decodeResourceInfo(raw);
    } catch (err) {
      throw wrapRPCError('wes_getResourceByContentHash', err);
    }
  }

  async getResources(filters: ResourceFilters): Promise<ResourceInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceType) req.resourceType = filters.resourceType;
      if (filters.owner) {
        // 将 owner 转换为 hex 字符串
        req.owner = `0x${Array.from(filters.owner)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`;
      }
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // 调用 WES 标准 RPC：wes_getResources
      // 参数格式：[{ filters: { resourceType, owner, limit, offset } }]
      const raw = await this.client.call('wes_getResources', [{ filters: req }]);
      const wire = decodeResourceArray(raw);
      return wire.map(mapWireResourceToDomain);
    } catch (err) {
      // 如果 RPC 不存在，返回空数组（或抛出错误，取决于设计）
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError('wes_getResources', err);
      }
      throw wrapRPCError('wes_getResources', err);
    }
  }

  async getTransaction(txId: string): Promise<TransactionInfo> {
    try {
      const params = { txId };
      const raw = await this.client.call('wes_getTransactionByHash', [params]);
      return decodeTransactionInfo(raw);
    } catch (err) {
      throw wrapRPCError('wes_getTransactionByHash', err);
    }
  }

  async getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`;
      }
      if (filters.txId) req.txId = filters.txId;
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // 注意：当前节点可能没有 wes_getTransactionHistory，需要根据实际 RPC 调整
      const raw = await this.client.call('wes_getTransactionHistory', [{ filters: req }]);
      const wire = decodeTransactionArray(raw);
      return wire.map(mapWireTransactionToDomain);
    } catch (err) {
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError('wes_getTransactionHistory', err);
      }
      throw wrapRPCError('wes_getTransactionHistory', err);
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
      throw wrapRPCError('wes_sendRawTransaction', err);
    }
  }

  async getEvents(filters: EventFilters): Promise<EventInfo[]> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`;
      }
      if (filters.eventName) req.eventName = filters.eventName;
      if (filters.limit != null) req.limit = filters.limit;
      if (filters.offset != null) req.offset = filters.offset;

      // 注意：当前节点可能没有 wes_getEvents，需要根据实际 RPC 调整
      const raw = await this.client.call('wes_getEvents', [{ filters: req }]);
      const wire = decodeEventArray(raw);
      return wire.map(mapWireEventToDomain);
    } catch (err) {
      if (err instanceof JSONRPCError && err.rpcCode === -32601) {
        throw wrapRPCError('wes_getEvents', err);
      }
      throw wrapRPCError('wes_getEvents', err);
    }
  }

  async subscribeEvents(filters: EventFilters): Promise<EventSubscription> {
    try {
      const req: any = {};
      if (filters.resourceId) {
        req.resourceId = `0x${Array.from(filters.resourceId)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`;
      }
      if (filters.eventName) req.eventName = filters.eventName;

      // 使用 WebSocket 订阅
      // IClient.subscribe 返回的 EventSubscription 与 WESClient 的 EventSubscription 兼容
      return await this.client.subscribe(req) as EventSubscription;
    } catch (err) {
      throw wrapRPCError('wes_subscribeEvents', err);
    }
  }

  async getNodeInfo(): Promise<NodeInfo> {
    try {
      // 组合多个 RPC 调用获取节点信息
      const [chainId, blockNumber] = await Promise.all([
        this.client.call('wes_chainId', []),
        this.client.call('wes_blockNumber', []),
      ]);

      return {
        rpcVersion: '1.0.0', // TODO: 从节点获取实际版本
        chainId: typeof chainId === 'string' ? chainId : '0x1',
        blockHeight: typeof blockNumber === 'string' 
          ? parseInt(blockNumber, 16) 
          : typeof blockNumber === 'number' 
          ? blockNumber 
          : 0,
      };
    } catch (err) {
      throw wrapRPCError('wes_getNodeInfo', err);
    }
  }

  async batchGetUTXOs(outPoints: OutPoint[]): Promise<UTXO[]> {
    // 使用 utils/batch 进行可控并发的批量查询
    return batchGetUTXOsSimple(this, outPoints);
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
  if (!raw || typeof raw !== 'object') {
    throw new WESClientError('DECODE_FAILED', 'Invalid UTXO response format');
  }
  
  // 如果包含 outpoint 字符串（格式：txhash:index）
  if (raw.outpoint && typeof raw.outpoint === 'string') {
    const [txId, indexStr] = raw.outpoint.split(':');
    const outputIndex = parseInt(indexStr, 10) || 0;
    
    return {
      outPoint: {
        txId: txId.startsWith('0x') ? txId : `0x${txId}`,
        outputIndex,
      },
      output: {
        amount: raw.amount || '0',
        tokenID: raw.tokenID || raw.token_id,
        contractAddress: raw.contractAddress || raw.contract_address,
        height: raw.height || '0x0',
      },
      lockingCondition: raw.lockingCondition || raw.locking_condition || {},
    } as UTXO;
  }
  
  // 标准格式
  return {
    outPoint: {
      txId: raw.txId || raw.tx_id || '',
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
  const contentHashStr = w.contentHash || w.content_hash || '0x00';
  const resourceIdBytes = hexStringToBytes(contentHashStr);
  
  // 解析 resourceType（优先使用 WES 标准字段 resourceType）
  // WES buildResourceMetadata 已经提供了标准化的 resourceType 字段：'contract' | 'model' | 'static'
  const typeSource = w.resourceType || w.resource_type || w.category || w.resource_category;
  const resourceType = mapResourceType(
    typeof typeSource === 'string' ? typeSource : 'static'
  );

  // 解析 createdAt（支持多种格式）
  let createdAt: Date;
  if (w.createdAt) {
    createdAt = new Date(w.createdAt);
  } else if (w.createdTimestamp) {
    // uint64 时间戳（秒级）
    const ts = typeof w.createdTimestamp === 'string' 
      ? parseInt(w.createdTimestamp, 10) 
      : w.createdTimestamp;
    createdAt = new Date(ts * 1000);
  } else {
    createdAt = new Date();
  }

  // 提取元数据字段（严格来自链上，不推导）
  const name = typeof w.name === 'string' && w.name.trim() !== '' ? w.name : undefined;
  const version = typeof w.version === 'string' && w.version.trim() !== '' ? w.version : undefined;
  const description = typeof w.description === 'string' && w.description.trim() !== '' ? w.description : undefined;
  const creatorAddress = typeof w.creator_address === 'string' && w.creator_address.trim() !== '' 
    ? w.creator_address 
    : typeof w.creatorAddress === 'string' && w.creatorAddress.trim() !== ''
    ? w.creatorAddress
    : undefined;
  
  // 提取 tags（从 custom_attributes 或 metadata.tags）
  let tags: string[] | undefined;
  if (Array.isArray(w.tags)) {
    tags = w.tags.filter((t: any) => typeof t === 'string' && t.trim() !== '');
  } else if (w.custom_attributes && typeof w.custom_attributes === 'object') {
    // 尝试从 custom_attributes 中提取 tags
    if (Array.isArray(w.custom_attributes.tags)) {
      tags = w.custom_attributes.tags.filter((t: any) => typeof t === 'string' && t.trim() !== '');
    }
  }
  if (tags && tags.length === 0) {
    tags = undefined;
  }

  // 提取 custom_attributes（如果存在）
  const customAttributes = w.custom_attributes && typeof w.custom_attributes === 'object' 
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
    if (typeof w.blockHeight === 'string') {
      // hex 字符串格式 "0x1234"
      const cleanHex = w.blockHeight.startsWith('0x') ? w.blockHeight.slice(2) : w.blockHeight;
      blockHeight = parseInt(cleanHex, 16);
    } else if (typeof w.blockHeight === 'number') {
      blockHeight = w.blockHeight;
    }
  }

  // 解析 timestamp（可能是多种格式）
  let timestamp: Date;
  if (w.timestamp) {
    if (typeof w.timestamp === 'string') {
      timestamp = new Date(w.timestamp);
    } else if (typeof w.timestamp === 'number') {
      timestamp = new Date(w.timestamp);
    } else {
      timestamp = new Date();
    }
  } else if (w.creationTimestamp) {
    // 使用 creationTimestamp（可能是 uint64）
    const ts = typeof w.creationTimestamp === 'string' 
      ? parseInt(w.creationTimestamp, 10) 
      : w.creationTimestamp;
    timestamp = new Date(ts * 1000); // 假设是秒级时间戳
  } else {
    timestamp = new Date();
  }

  // 确定交易 ID（hash 字段优先）
  const txId = w.hash || w.txId || w.tx_id || w.txHash || w.tx_hash || '';

  // 确定状态（根据 blockHeight 判断）
  let status: 'pending' | 'confirmed' | 'failed' = 'pending';
  if (w.status) {
    status = mapTransactionStatus(w.status);
  } else if (blockHeight !== undefined && blockHeight > 0) {
    status = 'confirmed';
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
    if (typeof w.blockHeight === 'string') {
      const cleanHex = w.blockHeight.startsWith('0x') ? w.blockHeight.slice(2) : w.blockHeight;
      blockHeight = parseInt(cleanHex, 16);
    } else if (typeof w.blockHeight === 'number') {
      blockHeight = w.blockHeight;
    }
  }

  // 解析 timestamp
  let timestamp: Date;
  if (w.timestamp) {
    if (typeof w.timestamp === 'string') {
      timestamp = new Date(w.timestamp);
    } else if (typeof w.timestamp === 'number') {
      timestamp = new Date(w.timestamp);
    } else {
      timestamp = new Date();
    }
  } else {
    timestamp = new Date();
  }

  return {
    eventName: w.eventName || w.event_name || '',
    resourceId: hexStringToBytes(w.resourceId || w.resource_id || '0x00'),
    data: hexStringToBytes(w.data || '0x00'),
    txId: w.txId || w.tx_id || w.txHash || w.tx_hash || '',
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
  if (typeof tx === 'string') {
    // 已经是 hex 字符串
    return tx.startsWith('0x') ? tx : `0x${tx}`;
  }
  
  if (typeof tx === 'object' && tx !== null) {
    // TODO: 如果未来需要支持对象格式，需要使用 protobuf 序列化
    // 当前节点 API 期望的是已签名的交易 hex 字符串
    // 交易构建和签名应该在 SDK 的上层完成（如 TransactionBuilder）
    throw new WESClientError(
      'DECODE_FAILED',
      'Transaction object encoding not supported. Please provide a signed transaction hex string.'
    );
  }
  
  throw new WESClientError('DECODE_FAILED', 'Invalid transaction format');
}

/**
 * 映射资源类型
 * 
 * 优先支持 WES 标准字段值：'contract' | 'model' | 'static'
 * 对于 category 字段（如 'RESOURCE_CATEGORY_EXECUTABLE'）作为兜底处理
 */
function mapResourceType(type: string): 'contract' | 'model' | 'static' {
  const t = type.toLowerCase().trim();
  
  // WES 标准 resourceType 值（优先）
  if (t === 'contract') return 'contract';
  if (t === 'model' || t === 'aimodel') return 'model';
  if (t === 'static' || t === 'file') return 'static';
  
  // 对于 category 字段的兜底处理（EXECUTABLE -> contract，其他 -> static）
  if (t.includes('executable')) return 'contract';
  
  // 默认返回 static
  return 'static';
}

/**
 * 映射交易状态
 */
function mapTransactionStatus(status: string): 'pending' | 'confirmed' | 'failed' {
  switch (status) {
    case 'confirmed':
    case 'success':
      return 'confirmed';
    case 'failed':
      return 'failed';
    case 'pending':
    default:
      return 'pending';
  }
}

/**
 * 将 hex 字符串转换为 Uint8Array
 */
function hexStringToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  return bytes;
}

