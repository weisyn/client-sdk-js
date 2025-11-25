/**
 * 交易构建和签名通用工具函数
 *
 * **架构说明**：
 * - 提供通用的交易构建、签名哈希计算、交易完成等函数
 * - 支持 Draft 模式的交易构建流程
 */

import { IClient } from "../client/client";
import { Wallet } from "../wallet/wallet";
import { bytesToHex, hexToBytes } from "./hex";
import { addressToHex } from "./address";

/**
 * UTXO 信息（从 wes_getUTXO API 返回）
 */
export interface UTXO {
  outpoint: string; // "txHash:outputIndex"
  height: string; // "0x..."
  amount: string; // 金额（字符串）
  tokenID?: string; // 代币ID（hex编码，可选）
}

/**
 * 交易草稿（JSON 格式）
 */
export interface TransactionDraft {
  sign_mode: "defer_sign";
  inputs: Array<{
    tx_hash: string;
    output_index: number;
    is_reference_only: boolean;
  }>;
  outputs: Array<any>;
  metadata?: {
    caller_address?: string;
    [key: string]: any;
  };
}

/**
 * 计算签名哈希并完成交易的参数
 */
export interface FinalizeTransactionParams {
  draft: string | object; // DraftJSON 字符串或对象
  unsignedTx?: string; // 未签名交易（hex）
  input_index: number; // 输入索引
  sighash_type: string; // 签名哈希类型，通常是 "SIGHASH_ALL"
  pubkey: string; // 压缩公钥（hex，带 0x 前缀）
  signature: string; // 签名（hex，带 0x 前缀）
}

/**
 * 查询 UTXO 列表
 */
export async function queryUTXO(client: IClient, addressHex: string): Promise<UTXO[]> {
  const utxoResult = await client.call("wes_getUTXO", [addressHex]);

  if (!utxoResult || typeof utxoResult !== "object") {
    throw new Error("Invalid UTXO response format");
  }

  const utxoData = utxoResult as { utxos?: any[] };
  const utxosArray = utxoData.utxos || [];

  // 转换为 UTXO 结构
  return utxosArray.map((item: any) => ({
    outpoint: item.outpoint || "",
    height: item.height || "0x0",
    amount: item.amount || "0",
    tokenID: item.tokenID || item.token_id,
  }));
}

/**
 * 选择足够的 UTXO（原生币）
 */
export function selectNativeCoinUTXO(
  utxos: UTXO[],
  requiredAmount: bigint
): { selected: UTXO[]; totalAmount: bigint } | null {
  // 过滤原生币（没有 tokenID 的 UTXO）
  const nativeUTXOs = utxos.filter((utxo) => !utxo.tokenID || utxo.tokenID === "");

  if (nativeUTXOs.length === 0) {
    return null;
  }

  // 选择足够的 UTXO（简化实现：选择第一个足够的 UTXO）
  for (const utxo of nativeUTXOs) {
    const amount = BigInt(utxo.amount);
    if (amount >= requiredAmount) {
      return {
        selected: [utxo],
        totalAmount: amount,
      };
    }
  }

  // 如果没有单个 UTXO 足够，尝试组合多个 UTXO
  const selected: UTXO[] = [];
  let totalAmount = BigInt(0);

  for (const utxo of nativeUTXOs) {
    selected.push(utxo);
    totalAmount += BigInt(utxo.amount);

    if (totalAmount >= requiredAmount) {
      return { selected, totalAmount };
    }
  }

  return null;
}

/**
 * 获取当前区块高度
 */
export async function getCurrentBlockHeight(client: IClient): Promise<number> {
  try {
    const heightResult = await client.call("wes_blockNumber", []);

    if (typeof heightResult === "string") {
      const cleanHex = heightResult.startsWith("0x") ? heightResult.slice(2) : heightResult;
      // 尝试解析十六进制
      const height = parseInt(cleanHex, 16);
      if (!isNaN(height)) {
        return height;
      }
      // 尝试解析十进制
      const heightDecimal = parseInt(cleanHex, 10);
      if (!isNaN(heightDecimal)) {
        return heightDecimal;
      }
    } else if (typeof heightResult === "number") {
      return heightResult;
    }
  } catch (e) {
    // 忽略错误，返回 0
  }

  return 0;
}

/**
 * 计算签名哈希（从 Draft）
 *
 * **流程**：
 * 1. 调用 `wes_computeSignatureHashFromDraft` API
 * 2. 返回签名哈希和未签名交易
 */
export async function computeSignatureHashFromDraft(
  client: IClient,
  draft: string | object,
  inputIndex: number,
  sighashType: string = "SIGHASH_ALL"
): Promise<{ hash: Uint8Array; unsignedTx?: string }> {
  const draftJSON = typeof draft === "string" ? draft : JSON.stringify(draft);

  const hashParams = {
    draft: typeof draft === "string" ? JSON.parse(draftJSON) : draft,
    input_index: inputIndex,
    sighash_type: sighashType,
  };

  const hashResult = await client.call("wes_computeSignatureHashFromDraft", [hashParams]);

  if (!hashResult || typeof hashResult !== "object") {
    throw new Error("Invalid response format from wes_computeSignatureHashFromDraft");
  }

  const hashMap = hashResult as { hash?: string; unsignedTx?: string; unsigned_tx?: string };
  const hashHex = hashMap.hash;
  const unsignedTxHex = hashMap.unsignedTx || hashMap.unsigned_tx;

  if (!hashHex) {
    throw new Error("Missing hash in wes_computeSignatureHashFromDraft response");
  }

  const hashBytes = hexToBytes(hashHex.startsWith("0x") ? hashHex.slice(2) : hashHex);

  return {
    hash: hashBytes,
    unsignedTx: unsignedTxHex,
  };
}

/**
 * 完成交易（从 Draft）
 *
 * **流程**：
 * 1. 调用 `wes_finalizeTransactionFromDraft` API
 * 2. 返回已完成的交易（hex）
 */
export async function finalizeTransactionFromDraft(
  client: IClient,
  params: FinalizeTransactionParams
): Promise<string> {
  const draftJSON = typeof params.draft === "string" ? params.draft : JSON.stringify(params.draft);

  const finalizeParams = {
    draft: typeof params.draft === "string" ? JSON.parse(draftJSON) : params.draft,
    unsignedTx: params.unsignedTx,
    input_index: params.input_index,
    sighash_type: params.sighash_type,
    pubkey: params.pubkey,
    signature: params.signature,
  };

  const finalResult = await client.call("wes_finalizeTransactionFromDraft", [finalizeParams]);

  if (!finalResult || typeof finalResult !== "object") {
    throw new Error("Invalid response format from wes_finalizeTransactionFromDraft");
  }

  const finalMap = finalResult as { tx?: string; txHex?: string };
  const txHex = finalMap.tx || finalMap.txHex;

  if (!txHex) {
    throw new Error("Missing tx in wes_finalizeTransactionFromDraft response");
  }

  return txHex;
}

/**
 * 签名并提交交易（完整流程）
 *
 * **流程**：
 * 1. 计算签名哈希
 * 2. 使用 Wallet 签名哈希
 * 3. 完成交易
 * 4. 提交交易
 */
export async function signAndSubmitTransaction(
  client: IClient,
  wallet: Wallet,
  draft: string | object,
  inputIndex: number,
  sighashType: string = "SIGHASH_ALL"
): Promise<{ txHash: string; accepted: boolean }> {
  // 1. 计算签名哈希
  const { hash, unsignedTx } = await computeSignatureHashFromDraft(
    client,
    draft,
    inputIndex,
    sighashType
  );

  // 2. 使用 Wallet 签名哈希（同步方法）
  const signature = wallet.signHash(hash);

  // 3. 获取压缩公钥
  const publicKey = wallet.publicKey;
  // 压缩公钥：如果公钥是未压缩格式（65字节），需要压缩为33字节
  let pubkeyCompressed: Uint8Array;
  if (publicKey.length === 65) {
    // 未压缩格式：跳过第一个字节（0x04），取后64字节，然后压缩
    if (typeof require !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Point } = require("@noble/secp256k1");
      const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
      pubkeyCompressed = point.toRawBytes(true); // true = 压缩格式
    } else {
      throw new Error("require is not available. Please use ES module import for @noble/secp256k1");
    }
  } else if (publicKey.length === 33) {
    pubkeyCompressed = publicKey;
  } else {
    throw new Error(`Invalid public key length: ${publicKey.length}`);
  }

  // 4. 完成交易
  const signedTxHex = await finalizeTransactionFromDraft(client, {
    draft,
    unsignedTx,
    input_index: inputIndex,
    sighash_type: sighashType,
    pubkey: "0x" + bytesToHex(pubkeyCompressed),
    signature: "0x" + bytesToHex(signature),
  });

  // 5. 提交交易
  const sendResult = await client.sendRawTransaction(signedTxHex);

  return {
    txHash: sendResult.txHash,
    accepted: sendResult.accepted,
  };
}

/**
 * 解析交易输出，查找指定所有者的输出
 */
export function findOutputsByOwner(outputs: any[], owner: Uint8Array): any[] {
  const ownerHex = addressToHex(owner);
  return outputs.filter((output) => {
    const outputOwner = output.owner || output.Owner;
    if (typeof outputOwner === "string") {
      const cleanOwner = outputOwner.startsWith("0x") ? outputOwner.slice(2) : outputOwner;
      const cleanOwnerHex = ownerHex.startsWith("0x") ? ownerHex.slice(2) : ownerHex;
      return cleanOwner.toLowerCase() === cleanOwnerHex.toLowerCase();
    }
    return false;
  });
}

/**
 * 汇总指定代币的金额
 */
export function sumAmountsByToken(outputs: any[], tokenID: Uint8Array | null): bigint | null {
  const tokenIDHex = tokenID ? bytesToHex(tokenID) : "";
  let total = BigInt(0);
  let found = false;

  for (const output of outputs) {
    if (output.type !== "asset" && output.output_type !== "asset") {
      continue;
    }

    const assetContent = output.asset_content || output.assetContent || {};
    const assetType = assetContent.asset_type || assetContent.assetType;

    // 原生币
    if (!tokenID && (assetType === "native_coin" || !assetType)) {
      const amount = assetContent.amount || output.amount || "0";
      total += BigInt(amount);
      found = true;
    }
    // 合约代币
    else if (tokenID && assetType === "contract_token") {
      const outputTokenID = assetContent.token_id || assetContent.tokenID;
      if (outputTokenID && outputTokenID.toLowerCase() === tokenIDHex.toLowerCase()) {
        const amount = assetContent.amount || output.amount || "0";
        total += BigInt(amount);
        found = true;
      }
    }
  }

  return found ? total : null;
}
