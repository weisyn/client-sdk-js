/**
 * Governance 服务实现
 * 
 * **架构说明**：
 * - Governance 业务语义在 SDK 层，通过调用合约方法实现
 * - 支持提案、投票等功能
 */

import { IClient } from '../../client/client';
import { Wallet } from '../../wallet/wallet';
import {
  ProposeRequest,
  ProposeResult,
  VoteRequest,
  VoteResult,
} from './types';

/**
 * Governance 服务
 */
export class GovernanceService {
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
    throw new Error('Wallet is required');
  }

  /**
   * 创建提案
   */
  async propose(request: ProposeRequest, wallet?: Wallet): Promise<ProposeResult> {
    // TODO: 实现提案逻辑
    throw new Error('Not implemented');
  }

  /**
   * 投票
   */
  async vote(request: VoteRequest, wallet?: Wallet): Promise<VoteResult> {
    // TODO: 实现投票逻辑
    throw new Error('Not implemented');
  }
}
