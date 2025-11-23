/**
 * Transaction 服务实现
 * 
 * **架构说明**：
 * - Transaction Service 为 Workbench Explorer 场景提供交易查询和提交功能
 * - 基于 WESClient 类型化 API 实现
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import { WESClientImpl } from '../../client/wesclient';
import type { WESClient } from '../../client/wesclient';
import type {
  TransactionInfo,
  TransactionFilters,
  Transaction,
  SubmitTxResult,
} from '../../client/wesclient-types';

/**
 * TransactionService 交易服务接口
 */
export interface TransactionService {
  // 查询
  getTransaction(txId: string): Promise<TransactionInfo>;
  getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]>;
  
  // 提交
  submitTransaction(tx: Transaction, wallet?: Wallet): Promise<SubmitTxResult>;
}

/**
 * TransactionServiceImpl TransactionService 实现
 */
export class TransactionServiceImpl implements TransactionService {
  private wesClient?: WESClient;

  constructor(private client: IClient) {}

  /**
   * 获取 WESClient（延迟初始化）
   */
  private getWESClient(): WESClient {
    if (!this.wesClient) {
      this.wesClient = new WESClientImpl(this.client);
    }
    return this.wesClient;
  }

  /**
   * 获取交易信息
   */
  async getTransaction(txId: string): Promise<TransactionInfo> {
    const wesClient = this.getWESClient();
    return await wesClient.getTransaction(txId);
  }

  /**
   * 获取交易历史
   */
  async getTransactionHistory(filters: TransactionFilters): Promise<TransactionInfo[]> {
    const wesClient = this.getWESClient();
    return await wesClient.getTransactionHistory(filters);
  }

  /**
   * 提交交易
   * 
   * **注意**：如果提供了 wallet，会先签名交易再提交
   * 当前实现假设 tx 已经是签名后的交易（hex 字符串）
   */
  async submitTransaction(tx: Transaction, _wallet?: Wallet): Promise<SubmitTxResult> {
    const wesClient = this.getWESClient();
    
    // TODO: 如果 tx 是未签名交易且提供了 wallet，需要先签名
    // 当前实现假设 tx 已经是签名后的交易
    return await wesClient.submitTransaction(tx);
  }
}

