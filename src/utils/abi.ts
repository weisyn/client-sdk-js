/**
 * 轻量 ABI Helper
 * 
 * 提供合约调用 payload 构建功能，严格遵循 WES ABI 规范
 * 规范来源：weisyn.git/docs/components/core/ispc/abi-and-payload.md
 * 
 * 本模块不依赖 contract-sdk-js，实现最小 JSON + Base64 路径
 */

/**
 * Payload 构建选项
 */
export interface BuildPayloadOptions {
  /** 是否包含调用者地址（from） */
  includeFrom?: boolean;
  /** 调用者地址（20字节） */
  from?: Uint8Array;
  /** 是否包含金额（amount） */
  includeAmount?: boolean;
  /** 转账金额（大整数字符串或数字） */
  amount?: string | number | bigint;
  /** 是否包含代币ID（token_id） */
  includeTokenId?: boolean;
  /** 代币ID（32字节） */
  tokenId?: Uint8Array;
  /** 是否包含接收者地址（to） */
  includeTo?: boolean;
  /** 接收者地址（20字节） */
  to?: Uint8Array;
}

/**
 * ABI 方法参数信息（简化版，仅用于类型检查）
 */
export interface ABIParameter {
  name: string;
  type: string;
  required?: boolean;
}

/**
 * ABI 方法信息（简化版，仅用于类型检查）
 */
export interface ABIMethod {
  name: string;
  type?: string;
  parameters?: ABIParameter[];
}

/**
 * 将 Uint8Array 转换为十六进制字符串（带 0x 前缀）
 */
function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 将地址 Uint8Array 转换为十六进制字符串
 */
function addressToHex(address: Uint8Array): string {
  if (address.length !== 20) {
    throw new Error(`Address must be 20 bytes, got ${address.length}`);
  }
  return bytesToHex(address);
}

/**
 * 将代币ID Uint8Array 转换为十六进制字符串
 */
function tokenIdToHex(tokenId: Uint8Array): string {
  if (tokenId.length !== 32) {
    throw new Error(`TokenID must be 32 bytes, got ${tokenId.length}`);
  }
  return bytesToHex(tokenId);
}

/**
 * 将金额转换为字符串（大整数字符串）
 */
function amountToString(amount: string | number | bigint): string {
  if (typeof amount === 'string') {
    return amount;
  }
  if (typeof amount === 'bigint') {
    return amount.toString();
  }
  return amount.toString();
}

/**
 * 构建合约调用 payload JSON 对象
 * 
 * 根据 WES ABI 规范（abi-and-payload.md）：
 * - 保留字段：from, to, amount, token_id
 * - 扩展字段：从方法参数推导
 * 
 * @param methodInfo ABI 方法信息（可选，用于参数类型检查）
 * @param args 方法参数数组
 * @param options Payload 构建选项
 * @returns Payload JSON 对象
 */
export function buildPayload(
  methodInfo: ABIMethod | null,
  args: unknown[],
  options: BuildPayloadOptions = {}
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  // 1. 添加保留字段（根据选项）
  if (options.includeFrom && options.from) {
    payload.from = addressToHex(options.from);
  }

  if (options.includeTo && options.to) {
    payload.to = addressToHex(options.to);
  }

  if (options.includeAmount && options.amount !== undefined) {
    payload.amount = amountToString(options.amount);
  }

  if (options.includeTokenId && options.tokenId) {
    payload.token_id = tokenIdToHex(options.tokenId);
  }

  // 2. 添加方法参数（作为扩展字段）
  // 根据 WES ABI 规范，参数通过 payload 传递，而不是 params
  // 参数名作为键，参数值作为值
  if (methodInfo && methodInfo.parameters) {
    methodInfo.parameters.forEach((param, index) => {
      if (index < args.length) {
        // 参数名作为键，参数值作为值
        // 注意：如果参数名与保留字段冲突，这里会覆盖（但应该避免这种情况）
        // 根据 WES ABI 规范，扩展字段名不得与保留字段冲突
        const paramName = param.name;
        if (['from', 'to', 'amount', 'token_id'].includes(paramName)) {
          throw new Error(
            `Parameter name "${paramName}" conflicts with reserved field. ` +
            `Please use a different parameter name.`
          );
        }
        payload[paramName] = args[index];
      }
    });
  } else {
    // 如果没有方法信息，使用位置索引作为键（fallback）
    // 注意：这不符合最佳实践，建议提供 methodInfo
    args.forEach((arg, index) => {
      payload[`arg${index}`] = arg;
    });
  }

  return payload;
}

/**
 * 构建并编码 payload（JSON + Base64）
 * 
 * 这是主要入口函数，用于构建符合 WES ABI 规范的 payload
 * 
 * @param methodInfo ABI 方法信息（可选）
 * @param args 方法参数数组
 * @param options Payload 构建选项
 * @returns Base64 编码的 JSON payload 字符串
 */
export function buildAndEncodePayload(
  methodInfo: ABIMethod | null,
  args: unknown[],
  options: BuildPayloadOptions = {}
): string {
  // 1. 构建 payload JSON 对象
  const payload = buildPayload(methodInfo, args, options);

  // 2. 序列化为 JSON 字符串
  const payloadJSON = JSON.stringify(payload);

  // 3. Base64 编码
  // 在浏览器和 Node.js 环境中都可用
  if (typeof btoa !== 'undefined') {
    // 浏览器环境
    return btoa(payloadJSON);
  } else if (typeof Buffer !== 'undefined') {
    // Node.js 环境
    return Buffer.from(payloadJSON, 'utf-8').toString('base64');
  } else {
    // Fallback：手动实现 Base64 编码
    return manualBase64Encode(payloadJSON);
  }
}

/**
 * 手动 Base64 编码（fallback）
 */
function manualBase64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;

  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : 0;
    const c = i < str.length ? str.charCodeAt(i++) : 0;

    const bitmap = (a << 16) | (b << 8) | c;

    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '=';
  }

  return result;
}

