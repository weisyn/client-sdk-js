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

  /** ✅ 新增：锁定条件列表（支持 7 种类型） */
  lockingConditions?: import("./locking").LockingCondition[];

  /** ✅ 新增：锁定条件验证选项 */
  validateLockingConditions?: boolean; // 是否在SDK层验证（默认true）
  allowContractLockCycles?: boolean; // 是否允许ContractLock循环（默认false）
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
  type: "static" | "contract" | "aimodel";
  /** 文件大小 */
  size: number;
  /** MIME类型 */
  mimeType?: string;
  /** 所有者地址 */
  owner?: Uint8Array;
}

/**
 * OutPoint UTXO 位置引用
 */
export interface OutPoint {
  txId: string;
  outputIndex: number;
}

/**
 * ContractExecutionConfig 智能合约执行配置
 * 对应协议层 ContractExecutionConfig
 */
export interface ContractExecutionConfig {
  /** ABI 版本 */
  abiVersion?: string;
  /** 导出函数列表 */
  exportedFunctions?: string[];
  /** 执行参数（引擎特定） */
  executionParams?: Record<string, string>;
}

/**
 * AIModelExecutionConfig AI 模型执行配置
 * 对应协议层 AIModelExecutionConfig
 */
export interface AIModelExecutionConfig {
  /** 模型格式（ONNX, TensorFlow等） */
  modelFormat?: string;
  /** 输入张量名称 */
  inputNames?: string[];
  /** 输出张量名称 */
  outputNames?: string[];
  /** 执行参数（引擎特定） */
  executionParams?: Record<string, string>;
}

/**
 * ExecutionConfig 执行配置（oneof 类型）
 * 对应协议层 Resource.execution_config
 */
export type ExecutionConfig =
  | { type: "contract"; config: ContractExecutionConfig }
  | { type: "aimodel"; config: AIModelExecutionConfig }
  | { type: "none" };

/**
 * ResourceView 资源视图（完整的资源信息）
 *
 * 🎯 **核心职责**：
 * 统一的资源视图，包含 UTXO 信息、状态、引用计数等完整信息。
 *
 * 💡 **设计理念**：
 * - 整合 UTXO 视角和元数据视角
 * - 包含完整的资源信息
 * - 支持前端直接使用
 * - 统一使用 camelCase 命名
 */
export interface ResourceView {
  /** 资源身份 */
  contentHash: string;

  /** 资源分类 */
  category: "EXECUTABLE" | "STATIC";
  executableType?: "CONTRACT" | "AI_MODEL";

  /** 资源元信息 */
  mimeType?: string;
  size: number;

  /** ✅ 新增：执行配置（仅可执行资源） */
  executionConfig?: ExecutionConfig;

  /** ✅ 新增：文件信息 */
  originalFilename?: string;
  fileExtension?: string;

  /** UTXO 视角 */
  outPoint?: OutPoint;
  owner: string;
  status: "ACTIVE" | "CONSUMED" | "EXPIRED";
  creationTimestamp: number;
  expiryTimestamp?: number;
  isImmutable: boolean;

  /** ✅ 新增：锁定条件列表（从 UTXO 查询获取） */
  lockingConditions?: import("./locking").LockingCondition[];

  /** 使用统计 */
  currentReferenceCount: number;
  totalReferenceTimes: number;

  /** 区块信息 */
  deployTxId: string;
  deployBlockHeight?: number;  // ✅ 改为可选，因为节点可能不返回
  deployBlockHash: string;
  deployTimestamp?: number;  // ✅ 新增：部署区块时间戳（BlockHeader.timestamp）

  /** ✅ 新增：创建上下文（ResourceOutput.creation_context） */
  creationContext?: string;

  /** ✅ 新增：交易元数据（Transaction.metadata） */
  deployMemo?: string;  // Transaction.metadata.memo
  deployTags?: string[]; // Transaction.metadata.tags
}

/**
 * ResourceHistory 资源历史记录
 */
export interface ResourceHistory {
  deployTx?: TxSummary;
  upgrades: TxSummary[];
  referencesSummary?: ReferenceSummary;
}

/**
 * TxSummary 交易摘要
 */
export interface TxSummary {
  txId: string;
  blockHash: string;
  blockHeight: number;
  timestamp: number;
}

/**
 * ReferenceSummary 引用统计摘要
 */
export interface ReferenceSummary {
  totalReferences: number;
  uniqueCallers: number;
  lastReferenceTime: number;
}
