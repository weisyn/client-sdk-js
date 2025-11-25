/**
 * 批量转账实现
 *
 * **架构说明**：
 * - BatchTransfer 业务语义在 SDK 层，通过查询 UTXO、选择 UTXO、构建交易实现
 * - 所有转账必须使用同一个 tokenID
 */

import { IClient } from "../../client/client";
import { bytesToHex, hexToBytes } from "../../utils/hex";
import { addressToHex, addressBytesToBase58 } from "../../utils/address";
import { UTXO } from "./tx_builder";

/**
 * 构建批量转账交易
 */
export async function buildBatchTransferTransaction(
  client: IClient,
  fromAddress: Uint8Array,
  transfers: Array<{ to: Uint8Array; amount: bigint | number }>,
  tokenID: Uint8Array
): Promise<Uint8Array> {
  // 1. 验证所有转账使用同一个 tokenID
  if (!tokenID || tokenID.length !== 32) {
    throw new Error("TokenID is required and must be 32 bytes for batch transfer");
  }

  // 2. 计算总金额
  const totalAmount = transfers.reduce((sum, transfer) => {
    const amount = typeof transfer.amount === "bigint" ? transfer.amount : BigInt(transfer.amount);
    return sum + amount;
  }, BigInt(0));

  // 3. 查询 UTXO（节点 API 需要 Base58 格式）
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxoResult = await client.call("wes_getUTXO", [fromAddressBase58]);

  if (!utxoResult || typeof utxoResult !== "object") {
    throw new Error("Invalid UTXO response format");
  }

  const utxoData = utxoResult as { utxos?: any[] };
  const utxosArray = utxoData.utxos || [];

  if (utxosArray.length === 0) {
    throw new Error("No available UTXOs");
  }

  // 4. 转换为 UTXO 结构并过滤匹配 tokenID 的 UTXO
  const tokenIDHex = bytesToHex(tokenID);
  const matchingUTXOs: UTXO[] = utxosArray
    .map((item: any) => ({
      outpoint: item.outpoint || "",
      height: item.height || "0x0",
      amount: item.amount || "0",
      tokenID: item.tokenID || item.token_id,
    }))
    .filter((utxo: UTXO) => {
      return utxo.tokenID && utxo.tokenID.toLowerCase() === tokenIDHex.toLowerCase();
    });

  if (matchingUTXOs.length === 0) {
    throw new Error(`No available UTXOs for tokenID: ${tokenIDHex}`);
  }

  // 5. 选择足够的 UTXO
  const selectedUTXOs: UTXO[] = [];
  let totalSelectedAmount = BigInt(0);

  for (const utxo of matchingUTXOs) {
    selectedUTXOs.push(utxo);
    totalSelectedAmount += BigInt(utxo.amount);

    if (totalSelectedAmount >= totalAmount) {
      break;
    }
  }

  if (totalSelectedAmount < totalAmount) {
    throw new Error(
      `Insufficient balance: need ${totalAmount.toString()}, have ${totalSelectedAmount.toString()}`
    );
  }

  // 6. 构建交易草稿（批量转账）
  const draft = buildBatchTransactionDraft(fromAddress, transfers, tokenID, selectedUTXOs);

  // 7. 调用 `wes_buildTransaction` API 获取未签名交易
  const buildResult = await client.call("wes_buildTransaction", [draft]);

  if (!buildResult || typeof buildResult !== "object") {
    throw new Error("Invalid buildTransaction response format");
  }

  const buildData = buildResult as { unsigned_tx?: string; unsigned_tx_hex?: string };
  const unsignedTxHex = buildData.unsigned_tx || buildData.unsigned_tx_hex;

  if (!unsignedTxHex) {
    throw new Error("Missing unsigned_tx in buildTransaction response");
  }

  // 8. 转换为字节数组
  const cleanHex = unsignedTxHex.startsWith("0x") ? unsignedTxHex.slice(2) : unsignedTxHex;
  return hexToBytes(cleanHex);
}

/**
 * 构建批量转账交易草稿
 */
function buildBatchTransactionDraft(
  fromAddress: Uint8Array,
  transfers: Array<{ to: Uint8Array; amount: bigint | number }>,
  tokenID: Uint8Array,
  selectedUTXOs: UTXO[]
): any {
  const fromAddressHex = addressToHex(fromAddress);
  const tokenIDHex = bytesToHex(tokenID);

  // 构建输入
  const inputs = selectedUTXOs.map((utxo, index) => {
    const [txHash, outputIndex] = utxo.outpoint.split(":");
    return {
      tx_hash: txHash,
      output_index: parseInt(outputIndex, 10),
      is_reference_only: false,
      sequence: index,
    };
  });

  // 构建输出
  const outputs: any[] = [];

  // 为每个转账创建输出
  for (const transfer of transfers) {
    const toAddressHex = addressToHex(transfer.to);
    const amount =
      typeof transfer.amount === "bigint" ? transfer.amount.toString() : transfer.amount.toString();

    outputs.push({
      owner: toAddressHex,
      output_type: "asset",
      asset_content: {
        asset_type: "contract_token",
        amount,
        contract_address: "", // TODO: 从 tokenID 获取合约地址
        token_id: tokenIDHex,
      },
      locking_condition: {
        type: "single_key_lock",
        required_address: toAddressHex,
      },
    });
  }

  // 计算找零
  const totalInputAmount = selectedUTXOs.reduce(
    (sum, utxo) => sum + BigInt(utxo.amount),
    BigInt(0)
  );
  const totalTransferAmount = transfers.reduce((sum, transfer) => {
    const amount = typeof transfer.amount === "bigint" ? transfer.amount : BigInt(transfer.amount);
    return sum + amount;
  }, BigInt(0));

  // TODO: 计算手续费
  const fee = BigInt(0);
  const changeAmount = totalInputAmount - totalTransferAmount - fee;

  if (changeAmount > BigInt(0)) {
    outputs.push({
      owner: fromAddressHex,
      output_type: "asset",
      asset_content: {
        asset_type: "contract_token",
        amount: changeAmount.toString(),
        contract_address: "", // TODO: 从 tokenID 获取合约地址
        token_id: tokenIDHex,
      },
      locking_condition: {
        type: "single_key_lock",
        required_address: fromAddressHex,
      },
    });
  }

  // 构建交易草稿
  return {
    version: 1,
    inputs,
    outputs,
    nonce: Date.now(),
    creation_timestamp: Math.floor(Date.now() / 1000),
    chain_id: "wes", // TODO: 从客户端获取链ID
  };
}
