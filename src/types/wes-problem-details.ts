/**
 * WES Problem Details 类型定义（基于 RFC7807 + WES 扩展）
 */

/**
 * WES Problem Details 接口
 */
export interface WesProblemDetails {
  // RFC7807 标准字段
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;

  // WES 扩展字段（必填）
  code: string;
  layer: string;
  userMessage: string;
  details?: Record<string, any>;
  traceId: string;
  timestamp: string;
}

/**
 * WES Error 类
 */
export class WesError extends Error {
  public readonly code: string;
  public readonly layer: string;
  public readonly userMessage: string;
  public readonly detail?: string;
  public readonly status?: number;
  public readonly details?: Record<string, any>;
  public readonly traceId: string;
  public readonly timestamp: string;

  constructor(problem: WesProblemDetails) {
    super(problem.userMessage || problem.detail || problem.title || "Unknown error");
    this.name = "WesError";
    this.code = problem.code;
    this.layer = problem.layer;
    this.userMessage = problem.userMessage;
    this.detail = problem.detail;
    this.status = problem.status;
    this.details = problem.details;
    this.traceId = problem.traceId;
    this.timestamp = problem.timestamp;

    // 保持原型链
    Object.setPrototypeOf(this, WesError.prototype);
  }

  /**
   * 从 Problem Details 创建 WesError
   */
  static fromProblemDetails(problem: WesProblemDetails): WesError {
    return new WesError(problem);
  }

  /**
   * 转换为 Problem Details
   */
  toProblemDetails(): WesProblemDetails {
    return {
      code: this.code,
      layer: this.layer,
      userMessage: this.userMessage,
      detail: this.detail,
      status: this.status,
      details: this.details,
      traceId: this.traceId,
      timestamp: this.timestamp,
    };
  }

  /**
   * 检查错误是否为 WesError
   */
  static isWesError(error: any): error is WesError {
    return error instanceof WesError;
  }
}

/**
 * Layer 常量
 */
export const Layer = {
  CLIENT_SDK_JS: "client-sdk-js",
  BLOCKCHAIN_SERVICE: "blockchain-service",
  CONTRACT_COMPILER: "contract-compiler",
  CONTRACT_WORKBENCH_UI: "contract-workbench-ui",
} as const;

/**
 * 错误码常量
 */
export const ErrorCode = {
  // SDK 错误
  SDK_HTTP_ERROR: "SDK_HTTP_ERROR",
  SDK_GRPC_ERROR: "SDK_GRPC_ERROR",
  SDK_REQUEST_SERIALIZATION_ERROR: "SDK_REQUEST_SERIALIZATION_ERROR",
  SDK_RESPONSE_DESERIALIZATION_ERROR: "SDK_RESPONSE_DESERIALIZATION_ERROR",
  SDK_CONNECTION_ERROR: "SDK_CONNECTION_ERROR",

  // 通用错误
  COMMON_VALIDATION_ERROR: "COMMON_VALIDATION_ERROR",
  COMMON_INTERNAL_ERROR: "COMMON_INTERNAL_ERROR",
  COMMON_TIMEOUT: "COMMON_TIMEOUT",
  COMMON_SERVICE_UNAVAILABLE: "COMMON_SERVICE_UNAVAILABLE",
} as const;

/**
 * 从 HTTP 响应解析 Problem Details
 */
export async function parseProblemDetails(response: Response): Promise<WesProblemDetails | null> {
  const contentType = response.headers.get("Content-Type");

  if (contentType && contentType.includes("application/problem+json")) {
    try {
      const problem = (await response.json()) as WesProblemDetails;

      // 验证必填字段
      if (problem.code && problem.layer && problem.userMessage && problem.traceId) {
        return problem;
      }
    } catch (error) {
      console.warn("Failed to parse Problem Details:", error);
    }
  }

  return null;
}

/**
 * 从 JSON-RPC 错误响应解析 Problem Details
 */
export function parseProblemDetailsFromRPCError(rpcError: any): WesProblemDetails | null {
  // 检查 data 字段是否包含 Problem Details
  if (rpcError.data && typeof rpcError.data === "object") {
    const data = rpcError.data;

    // 检查是否包含 Problem Details 必填字段
    if (data.code && data.layer && data.userMessage && data.traceId) {
      return {
        code: data.code,
        layer: data.layer,
        userMessage: data.userMessage,
        detail: data.detail || rpcError.message,
        status: data.status || rpcError.code,
        details: data.details,
        traceId: data.traceId,
        timestamp: data.timestamp,
        type: data.type,
        title: data.title,
        instance: data.instance,
      };
    }
  }

  return null;
}

/**
 * 创建默认的 WesError（用于 fallback）
 */
export function createDefaultWesError(
  code: string,
  userMessage: string,
  detail: string,
  status: number = 500,
  details?: Record<string, any>
): WesError {
  return new WesError({
    code,
    layer: Layer.CLIENT_SDK_JS,
    userMessage,
    detail,
    status,
    details,
    traceId: `fallback-${Date.now()}`,
    timestamp: new Date().toISOString(),
  });
}
