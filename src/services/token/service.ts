/**
 * Token 服务实现
 *
 * **架构说明**：
 * - Transfer 业务语义在 SDK 层，通过查询 UTXO、选择 UTXO、构建交易实现
 * - 流程：构建交易草稿 → 调用节点 API 构建未签名交易 → Wallet 签名 → 提交已签名交易
 */

import { IClient } from "../../client/client";
import { Wallet } from "../../wallet/wallet";
import {
  TransferRequest,
  TransferResult,
  BatchTransferRequest,
  BatchTransferResult,
  MintRequest,
  MintResult,
  BurnRequest,
  BurnResult,
} from "./types";
import { buildTransferTransaction } from "./tx_builder";
import { buildBatchTransferTransaction } from "./batch_transfer";
import { buildBurnTransaction } from "./burn";
import { bytesToHex, hexToBytes } from "../../utils/hex";
import { addressToHex, addressBytesToBase58 } from "../../utils/address";

/**
 * Token 服务
 */
export class TokenService {
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
    throw new Error("Wallet is required");
  }

  /**
   * 单笔转账
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建未签名交易
   * 4. 使用 Wallet 签名交易
   * 5. 调用 wes_sendRawTransaction 提交已签名交易
   */
  async transfer(request: TransferRequest, wallet?: Wallet): Promise<TransferResult> {
    // 1. 参数验证
    this.validateTransferRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error("Wallet address does not match from address");
    }

    // 4. 在 SDK 层构建未签名交易
    const unsignedTxBytes = await buildTransferTransaction(
      this.client,
      request.from,
      request.to,
      request.amount,
      request.tokenId
    );

    // 5. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 6. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = "0x" + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 7. 返回结果
    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 批量转账
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建未签名交易
   * 4. 使用 Wallet 签名交易
   * 5. 调用 wes_sendRawTransaction 提交已签名交易
   *
   * **注意**：所有转账必须使用同一个 tokenID
   */
  async batchTransfer(
    request: BatchTransferRequest,
    wallet?: Wallet
  ): Promise<BatchTransferResult> {
    // 1. 参数验证
    if (request.transfers.length === 0) {
      throw new Error("At least one transfer is required");
    }
    if (request.from.length !== 20) {
      throw new Error("From address must be 20 bytes");
    }
    if (!request.tokenId || request.tokenId.length !== 32) {
      throw new Error("TokenID is required and must be 32 bytes");
    }

    // 验证所有转账的接收方地址
    for (const transfer of request.transfers) {
      if (transfer.to.length !== 20) {
        throw new Error("All transfer recipients must have 20-byte addresses");
      }
      const amount =
        typeof transfer.amount === "bigint" ? transfer.amount : BigInt(transfer.amount);
      if (amount <= 0n) {
        throw new Error("All transfer amounts must be greater than 0");
      }
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error("Wallet address does not match from address");
    }

    // 4. 在 SDK 层构建未签名交易
    const unsignedTxBytes = await buildBatchTransferTransaction(
      this.client,
      request.from,
      request.transfers,
      request.tokenId
    );

    // 5. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 6. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = "0x" + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 7. 返回结果
    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined,
    };
  }

  /**
   * 代币铸造
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 确定合约 contentHash
   * 3. 构建 mint 方法参数（通过 payload）
   * 4. 调用 `wes_callContract` API，设置 `return_unsigned_tx=true` 获取未签名交易
   * 5. 使用 Wallet 签名未签名交易
   * 6. 调用 `wes_sendRawTransaction` 提交已签名交易
   */
  async mint(request: MintRequest, wallet?: Wallet): Promise<MintResult> {
    // 1. 参数验证
    if (request.to.length !== 20) {
      throw new Error("To address must be 20 bytes");
    }
    const amount = typeof request.amount === "bigint" ? request.amount : BigInt(request.amount);
    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
    if (!request.tokenId || request.tokenId.length !== 32) {
      throw new Error("TokenID is required and must be 32 bytes");
    }
    if (!request.contractAddr || request.contractAddr.length !== 20) {
      throw new Error("Contract address is required and must be 20 bytes");
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 确定合约 contentHash（简化实现：使用 tokenID 作为 contentHash）
    // TODO: 实际应该从 contractAddr 查询合约的 contentHash
    const contentHash = request.tokenId;

    // 4. 构建 mint 方法的参数（通过 payload）
    const mintParams: any = {
      to: addressToHex(request.to),
      amount: amount.toString(),
      tokenID: bytesToHex(request.tokenId),
      contractAddr: addressToHex(request.contractAddr),
    };

    // 将参数编码为 JSON，然后 Base64 编码
    const payloadJSON = JSON.stringify(mintParams);
    const payloadBase64 = Buffer.from(payloadJSON).toString("base64");

    // 5. 调用 wes_callContract API，设置 return_unsigned_tx=true
    const callContractParams = {
      content_hash: bytesToHex(contentHash),
      method: "mint",
      params: [], // WASM 原生参数（空，使用 payload）
      payload: payloadBase64,
      return_unsigned_tx: true,
    };

    const result = await this.client.call("wes_callContract", [callContractParams]);

    if (!result || typeof result !== "object") {
      throw new Error("Invalid callContract response format");
    }

    const resultMap = result as { unsignedTx?: string; unsigned_tx?: string };
    const unsignedTxHex = resultMap.unsignedTx || resultMap.unsigned_tx;

    if (!unsignedTxHex) {
      throw new Error("Missing unsignedTx in callContract response");
    }

    // 6. 解码未签名交易
    const cleanHex = unsignedTxHex.startsWith("0x") ? unsignedTxHex.slice(2) : unsignedTxHex;
    const unsignedTxBytes = hexToBytes(cleanHex);

    // 7. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 8. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = "0x" + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 9. 返回结果
    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined,
    };
  }

  /**
   * 代币销毁
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建未签名交易（消费 UTXO 但不创建输出）
   * 4. 使用 Wallet 签名交易
   * 5. 调用 wes_sendRawTransaction 提交已签名交易
   */
  async burn(request: BurnRequest, wallet?: Wallet): Promise<BurnResult> {
    // 1. 参数验证
    if (request.from.length !== 20) {
      throw new Error("From address must be 20 bytes");
    }
    const amount = typeof request.amount === "bigint" ? request.amount : BigInt(request.amount);
    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
    if (!request.tokenId || request.tokenId.length !== 32) {
      throw new Error("TokenID is required and must be 32 bytes");
    }

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.from)) {
      throw new Error("Wallet address does not match from address");
    }

    // 4. 在 SDK 层构建未签名交易
    const unsignedTxBytes = await buildBurnTransaction(
      this.client,
      request.from,
      request.amount,
      request.tokenId
    );

    // 5. 使用 Wallet 签名交易
    const signedTxBytes = await w.signTransaction(unsignedTxBytes);

    // 6. 调用 wes_sendRawTransaction 提交已签名交易
    const signedTxHex = "0x" + bytesToHex(signedTxBytes);
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 7. 返回结果
    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined,
    };
  }

  /**
   * 查询余额
   *
   * **流程**：
   * 1. 调用 `wes_getBalance` API 查询余额
   * 2. 返回余额（bigint）
   *
   * **注意**：不需要 Wallet
   */
  async getBalance(address: Uint8Array, _tokenId: Uint8Array | null): Promise<bigint> {
    // 1. 验证地址
    if (address.length !== 20) {
      throw new Error("Address must be 20 bytes");
    }

    // 2. 构建查询参数（节点 API 需要 Base58 格式）
    const addressBase58 = addressBytesToBase58(address);
    const params = [addressBase58, "latest"]; // blockParameter: "latest" | "pending" | blockNumber
    // TODO: tokenId 参数预留，未来可能用于查询特定代币余额

    // 3. 调用 JSON-RPC 方法
    const result = await this.client.call("wes_getBalance", params);

    if (result === null || result === undefined) {
      throw new Error("Invalid balance response");
    }

    // 4. 解析结果 - wes_getBalance 返回包含 balance 字段的对象
    let balanceStr: string;
    if (typeof result === "object" && result !== null) {
      // 对象格式：{ balance: "0x..." } 或 { balance: "..." }
      const balanceObj = result as { balance?: string | number };
      const balanceValue = balanceObj.balance;
      if (balanceValue === undefined || balanceValue === null) {
        throw new Error(
          `Invalid balance response format: balance field not found, got ${JSON.stringify(result)}`
        );
      }
      balanceStr = typeof balanceValue === "string" ? balanceValue : balanceValue.toString();
    } else if (typeof result === "string") {
      balanceStr = result;
    } else if (typeof result === "number") {
      balanceStr = result.toString();
    } else if (typeof result === "bigint") {
      return result;
    } else {
      throw new Error(
        `Invalid balance response format: ${typeof result}, value: ${JSON.stringify(result)}`
      );
    }

    // 5. 转换为 bigint（balance 可能是十六进制字符串，如 "0x4a817c800"）
    try {
      // 移除 0x 前缀（如果有）
      const cleanBalanceStr = balanceStr.startsWith("0x") ? balanceStr.slice(2) : balanceStr;
      return BigInt("0x" + cleanBalanceStr);
    } catch (error) {
      throw new Error(`Failed to parse balance: ${balanceStr}, error: ${error}`);
    }
  }

  /**
   * 验证转账请求
   */
  private validateTransferRequest(request: TransferRequest): void {
    // 1. 验证地址
    if (request.from.length !== 20) {
      throw new Error("From address must be 20 bytes");
    }
    if (request.to.length !== 20) {
      throw new Error("To address must be 20 bytes");
    }

    // 2. 验证金额
    const amount = typeof request.amount === "bigint" ? request.amount : BigInt(request.amount);
    if (amount <= 0n) {
      throw new Error("Amount must be greater than 0");
    }
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
}
