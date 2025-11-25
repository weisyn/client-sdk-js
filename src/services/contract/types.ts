/**
 * Contract Service 类型定义
 */

export * from "./service";

// 类型从内部 ABI helper 导出，遵循 WES ABI 规范
export type { ABIMethod, BuildPayloadOptions } from "../../utils/abi";
