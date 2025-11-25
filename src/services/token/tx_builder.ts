/**
 * 交易构建辅助工具
 * 
 * **架构说明**：
 * - 业务语义在 SDK 层实现
 * - 通过调用节点 API（wes_getUTXO, wes_buildTransaction）构建交易
 * - 支持原生币和合约代币转账
 */

import { IClient } from '../../client/client';
import { bytesToHex, hexToBytes } from '../../utils/hex';
import { addressToHex, addressBytesToBase58 } from '../../utils/address';

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
 * 交易草稿（JSON 格式，用于构建交易）
 */
export interface TransactionDraft {
  version: number;
  inputs: TxInputDraft[];
  outputs: TxOutputDraft[];
  nonce: number;
  creation_timestamp: number;
  chain_id: string;
}

/**
 * 交易输入草稿
 */
export interface TxInputDraft {
  tx_hash: string; // 十六进制
  output_index: number;
  is_reference_only: boolean;
  sequence: number;
}

/**
 * 交易输出草稿
 */
export interface TxOutputDraft {
  owner: string; // 十六进制地址
  output_type: 'asset' | 'resource' | 'state';
  asset_content?: AssetOutputDraft;
  locking_condition: LockingConditionDraft;
}

/**
 * 资产输出草稿
 */
export interface AssetOutputDraft {
  asset_type: 'native_coin' | 'contract_token';
  amount: string; // 金额（字符串）
  contract_address?: string; // 十六进制（合约代币）
  token_id?: string; // 十六进制（合约代币）
}

/**
 * 锁定条件草稿
 */
export interface LockingConditionDraft {
  type: 'single_key_lock';
  required_address: string; // 十六进制地址
}

/**
 * 构建单笔转账交易
 * 
 * **流程**：
 * 1. 查询发送方的 UTXO（通过 `wes_getUTXO` API）
 * 2. 过滤匹配 tokenID 的 UTXO
 * 3. 选择足够的 UTXO
 * 4. 计算手续费和找零
 * 5. 构建交易草稿（JSON 格式）
 * 6. 调用 `wes_buildTransaction` API 获取未签名交易
 */
export async function buildTransferTransaction(
  client: IClient,
  fromAddress: Uint8Array,
  toAddress: Uint8Array,
  amount: bigint | number,
  tokenID: Uint8Array | null
): Promise<Uint8Array> {
  // 1. 将地址转换为 Base58 格式（节点 API 需要 Base58 格式）
  const fromAddressBase58 = addressBytesToBase58(fromAddress);

  // 2. 查询 UTXO
  const utxoResult = await client.call('wes_getUTXO', [fromAddressBase58]);
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  const utxoData = utxoResult as { utxos?: any[] };
  const utxosArray = utxoData.utxos || [];

  if (utxosArray.length === 0) {
    throw new Error('No available UTXOs');
  }

  // 3. 转换为 UTXO 结构
  const utxos: UTXO[] = utxosArray.map((item: any) => ({
    outpoint: item.outpoint || '',
    height: item.height || '0x0',
    amount: item.amount || '0',
    tokenID: item.tokenID || item.token_id,
  }));

  // 4. 过滤匹配 tokenID 的 UTXO
  const tokenIDHex = tokenID ? bytesToHex(tokenID) : '';
  const matchingUTXOs = utxos.filter((utxo) => {
    if (!tokenID) {
      // 原生币：没有 tokenID 的 UTXO
      return !utxo.tokenID || utxo.tokenID === '';
    } else {
      // 合约代币：匹配相同 tokenID
      return utxo.tokenID && utxo.tokenID.toLowerCase() === tokenIDHex.toLowerCase();
    }
  });

  if (matchingUTXOs.length === 0) {
    throw new Error(`No available UTXOs for tokenID: ${tokenIDHex || 'native coin'}`);
  }

  // 5. 选择足够的 UTXO（简化实现：选择第一个足够的 UTXO）
  const amountStr = amount.toString();
  const selectedUTXOs: UTXO[] = [];
  let totalAmount = BigInt(0);

  for (const utxo of matchingUTXOs) {
    selectedUTXOs.push(utxo);
    totalAmount += BigInt(utxo.amount);
    
    if (totalAmount >= BigInt(amountStr)) {
      break;
    }
  }

  if (totalAmount < BigInt(amountStr)) {
    throw new Error(`Insufficient balance: need ${amountStr}, have ${totalAmount.toString()}`);
  }

  // 6. 构建交易草稿
  const draft = buildTransactionDraft(
    fromAddress,
    toAddress,
    amountStr,
    tokenID,
    selectedUTXOs
  );

  // 7. 调用 `wes_buildTransaction` API 获取未签名交易
  const buildResult = await client.call('wes_buildTransaction', [draft]);
  
  if (!buildResult || typeof buildResult !== 'object') {
    throw new Error('Invalid buildTransaction response format');
  }

  const buildData = buildResult as { unsigned_tx?: string; unsigned_tx_hex?: string };
  const unsignedTxHex = buildData.unsigned_tx || buildData.unsigned_tx_hex;

  if (!unsignedTxHex) {
    throw new Error('Missing unsigned_tx in buildTransaction response');
  }

  // 8. 转换为字节数组
  const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
  return hexToBytes(cleanHex);
}

/**
 * 构建交易草稿
 */
function buildTransactionDraft(
  fromAddress: Uint8Array,
  toAddress: Uint8Array,
  amount: string,
  tokenID: Uint8Array | null,
  selectedUTXOs: UTXO[]
): TransactionDraft {
  const fromAddressHex = addressToHex(fromAddress);
  const toAddressHex = addressToHex(toAddress);

  // 构建输入
  const inputs: TxInputDraft[] = selectedUTXOs.map((utxo, index) => {
    const [txHash, outputIndex] = utxo.outpoint.split(':');
    return {
      tx_hash: txHash,
      output_index: parseInt(outputIndex, 10),
      is_reference_only: false,
      sequence: index,
    };
  });

  // 构建输出
  const outputs: TxOutputDraft[] = [];

  // 转账输出
  const assetContent: AssetOutputDraft = tokenID
    ? {
        asset_type: 'contract_token',
        amount,
        contract_address: '', // TODO: 从 tokenID 获取合约地址
        token_id: bytesToHex(tokenID),
      }
    : {
        asset_type: 'native_coin',
        amount,
      };

  outputs.push({
    owner: toAddressHex,
    output_type: 'asset',
    asset_content: assetContent,
    locking_condition: {
      type: 'single_key_lock',
      required_address: toAddressHex,
    },
  });

  // 找零输出（如果有）
  const totalInputAmount = selectedUTXOs.reduce(
    (sum, utxo) => sum + BigInt(utxo.amount),
    BigInt(0)
  );
  const transferAmount = BigInt(amount);
  const changeAmount = totalInputAmount - transferAmount;

  // TODO: 计算手续费，这里简化处理
  const fee = BigInt(0); // 实际应该计算手续费
  const actualChange = changeAmount - fee;

  if (actualChange > BigInt(0)) {
    outputs.push({
      owner: fromAddressHex,
      output_type: 'asset',
      asset_content: tokenID
        ? {
            asset_type: 'contract_token',
            amount: actualChange.toString(),
            contract_address: '', // TODO: 从 tokenID 获取合约地址
            token_id: bytesToHex(tokenID),
          }
        : {
            asset_type: 'native_coin',
            amount: actualChange.toString(),
          },
      locking_condition: {
        type: 'single_key_lock',
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
    chain_id: 'wes', // TODO: 从客户端获取链ID
  };
}

