/**
 * Resource 服务类型定义
 */

/**
 * 部署静态资源请求
 */
export interface DeployStaticResourceRequest {
  /** 部署者地址（20字节） */
  from: Uint8Array;
  /** 文件路径或文件内容 */
  filePath?: string;
  fileContent?: Uint8Array;
  /** MIME类型 */
  mimeType: string;
}

/**
 * 部署静态资源结果
 */
export interface DeployStaticResourceResult {
  /** 内容哈希 */
  contentHash: Uint8Array;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 部署合约请求
 */
export interface DeployContractRequest {
  /** 部署者地址（20字节） */
  from: Uint8Array;
  /** WASM文件路径或内容 */
  wasmPath?: string;
  wasmContent?: Uint8Array;
  /** 合约名称 */
  contractName: string;
  /** 初始化参数 */
  initArgs?: Uint8Array;
}

/**
 * 部署合约结果
 */
export interface DeployContractResult {
  /** 合约地址 */
  contractAddress: Uint8Array;
  /** 内容哈希 */
  contentHash: Uint8Array;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 部署AI模型请求
 */
export interface DeployAIModelRequest {
  /** 部署者地址（20字节） */
  from: Uint8Array;
  /** 模型文件路径或内容 */
  modelPath?: string;
  modelContent?: Uint8Array;
  /** 模型名称 */
  modelName: string;
}

/**
 * 部署AI模型结果
 */
export interface DeployAIModelResult {
  /** 内容哈希 */
  contentHash: Uint8Array;
  /** 交易哈希 */
  txHash: string;
  /** 是否成功 */
  success: boolean;
  /** 区块高度 */
  blockHeight?: number;
}

/**
 * 资源信息
 */
export interface ResourceInfo {
  /** 内容哈希 */
  contentHash: string;
  /** 资源类型（static/contract/aimodel） */
  type: 'static' | 'contract' | 'aimodel';
  /** 文件大小 */
  size: number;
  /** MIME类型 */
  mimeType?: string;
  /** 所有者地址 */
  owner?: Uint8Array;
}
