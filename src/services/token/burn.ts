/**
 * 代币销毁实现
 * 
 * **架构说明**：
 * - Burn 业务语义在 SDK 层，通过查询 UTXO、选择 UTXO、构建交易实现
 * - Burn 交易通过消费 UTXO 但不创建输出（或只创建找零）来实现销毁
 */

import { IClient } from '../../client/client';
import { bytesToHex, hexToBytes } from '../../utils/hex';
import { addressToHex, addressBytesToBase58 } from '../../utils/address';
import { UTXO } from './tx_builder';

/**
 * 构建销毁交易
 */
export async function buildBurnTransaction(
  client: IClient,
  fromAddress: Uint8Array,
  amount: bigint | number,
  tokenID: Uint8Array
): Promise<Uint8Array> {
  // 1. 验证 tokenID
  if (!tokenID || tokenID.length !== 32) {
    throw new Error('TokenID is required and must be 32 bytes');
  }

  // 2. 查询 UTXO（节点 API 需要 Base58 格式）
  const fromAddressBase58 = addressBytesToBase58(fromAddress);
  const utxoResult = await client.call('wes_getUTXO', [fromAddressBase58]);
  
  if (!utxoResult || typeof utxoResult !== 'object') {
    throw new Error('Invalid UTXO response format');
  }

  const utxoData = utxoResult as { utxos?: any[] };
  const utxosArray = utxoData.utxos || [];

  if (utxosArray.length === 0) {
    throw new Error('No available UTXOs');
  }

  // 3. 转换为 UTXO 结构并过滤匹配 tokenID 的 UTXO
  const tokenIDHex = bytesToHex(tokenID);
  const matchingUTXOs: UTXO[] = utxosArray
    .map((item: any) => ({
      outpoint: item.outpoint || '',
      height: item.height || '0x0',
      amount: item.amount || '0',
      tokenID: item.tokenID || item.token_id,
    }))
    .filter((utxo: UTXO) => {
      return utxo.tokenID && utxo.tokenID.toLowerCase() === tokenIDHex.toLowerCase();
    });

  if (matchingUTXOs.length === 0) {
    throw new Error(`No available UTXOs for tokenID: ${tokenIDHex}`);
  }

  // 4. 选择足够的 UTXO
  const amountStr = typeof amount === 'bigint' ? amount.toString() : amount.toString();
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

  // 5. 构建交易草稿（销毁：只创建找零输出，不创建销毁输出）
  const draft = buildBurnTransactionDraft(
    fromAddress,
    amountStr,
    tokenID,
    selectedUTXOs
  );

  // 6. 调用 `wes_buildTransaction` API 获取未签名交易
  const buildResult = await client.call('wes_buildTransaction', [draft]);
  
  if (!buildResult || typeof buildResult !== 'object') {
    throw new Error('Invalid buildTransaction response format');
  }

  const buildData = buildResult as { unsigned_tx?: string; unsigned_tx_hex?: string };
  const unsignedTxHex = buildData.unsigned_tx || buildData.unsigned_tx_hex;

  if (!unsignedTxHex) {
    throw new Error('Missing unsigned_tx in buildTransaction response');
  }

  // 7. 转换为字节数组
  const cleanHex = unsignedTxHex.startsWith('0x') ? unsignedTxHex.slice(2) : unsignedTxHex;
  return hexToBytes(cleanHex);
}

/**
 * 构建销毁交易草稿
 */
function buildBurnTransactionDraft(
  fromAddress: Uint8Array,
  burnAmount: string,
  tokenID: Uint8Array,
  selectedUTXOs: UTXO[]
): any {
  const fromAddressHex = addressToHex(fromAddress);
  const tokenIDHex = bytesToHex(tokenID);

  // 构建输入
  const inputs = selectedUTXOs.map((utxo, index) => {
    const [txHash, outputIndex] = utxo.outpoint.split(':');
    return {
      tx_hash: txHash,
      output_index: parseInt(outputIndex, 10),
      is_reference_only: false,
      sequence: index,
    };
  });

  // 构建输出（只创建找零输出，不创建销毁输出）
  const outputs: any[] = [];

  // 计算找零
  const totalInputAmount = selectedUTXOs.reduce(
    (sum, utxo) => sum + BigInt(utxo.amount),
    BigInt(0)
  );
  const burnAmountBigInt = BigInt(burnAmount);

  // TODO: 计算手续费
  const fee = BigInt(0);
  const changeAmount = totalInputAmount - burnAmountBigInt - fee;

  // 如果有找零，创建找零输出
  if (changeAmount > BigInt(0)) {
    outputs.push({
      owner: fromAddressHex,
      output_type: 'asset',
      asset_content: {
        asset_type: 'contract_token',
        amount: changeAmount.toString(),
        contract_address: '', // TODO: 从 tokenID 获取合约地址
        token_id: tokenIDHex,
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
    outputs, // 销毁通过不创建输出实现
    nonce: Date.now(),
    creation_timestamp: Math.floor(Date.now() / 1000),
    chain_id: 'wes', // TODO: 从客户端获取链ID
  };
}

