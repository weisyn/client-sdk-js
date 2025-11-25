/**
 * Governance 服务实现
 *
 * **架构说明**：
 * - Governance 业务语义在 SDK 层，通过构建交易实现
 * - 支持提案、投票、参数更新等功能
 */

import { IClient } from "../../client/client";
import { Wallet } from "../../wallet/wallet";
import { bytesToHex } from "../../utils/hex";
import { computeSignatureHashFromDraft, finalizeTransactionFromDraft } from "../../utils/tx_utils";
import { buildProposeDraft, buildVoteDraft, buildUpdateParamDraft } from "./tx_builder";
import {
  ProposeRequest,
  ProposeResult,
  VoteRequest,
  VoteResult,
  UpdateParamRequest,
  UpdateParamResult,
} from "./types";

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
    throw new Error("Wallet is required");
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

  /**
   * 查找 StateOutput
   */
  private findStateOutputs(outputs: any[]): any[] {
    return outputs.filter((output) => {
      const outputType = output.type || output.Type;
      return outputType === "state";
    });
  }

  /**
   * 创建提案
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（使用 StateOutput）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 ProposalID
   */
  async propose(request: ProposeRequest, wallet?: Wallet): Promise<ProposeResult> {
    // 1. 参数验证
    this.validateProposeRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.proposer)) {
      throw new Error("Wallet address does not match proposer address");
    }

    // 4. 在 SDK 层构建交易草稿
    // TODO: 需要从配置或参数获取验证者地址列表
    // 当前简化：使用提案者地址作为验证者（实际应该查询验证者列表）
    const validatorAddresses = [request.proposer]; // 临时：使用提案者地址
    const threshold = 1; // 临时：需要1个签名

    const votingPeriod =
      typeof request.votingPeriod === "bigint"
        ? request.votingPeriod
        : BigInt(request.votingPeriod);
    const { draft, inputIndex } = await buildProposeDraft(
      this.client,
      request.proposer,
      request.title,
      request.description,
      votingPeriod,
      validatorAddresses,
      threshold
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      "SIGHASH_ALL"
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Point } = require("@noble/secp256k1");
        const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
        pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error(
          "require is not available. Please use ES module import for @noble/secp256k1"
        );
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: "SIGHASH_ALL",
      pubkey: "0x" + bytesToHex(pubkeyCompressed),
      signature: "0x" + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 10. 解析交易结果，提取 ProposalID
    let proposalID = "";
    try {
      // 查询交易详情
      const txResult = await this.client.call("wes_getTransactionByHash", [sendResult.txHash]);
      if (txResult && typeof txResult === "object") {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];

        // 查找 StateOutput（提案通常使用 StateOutput）
        const stateOutputs = this.findStateOutputs(outputs);
        if (stateOutputs.length > 0) {
          // 使用第一个 StateOutput 的 stateID 或 outpoint 作为 ProposalID
          const stateOutput = stateOutputs[0];
          const stateID = stateOutput.state_id || stateOutput.stateID;
          const outpoint = stateOutput.outpoint || stateOutput.Outpoint;

          if (stateID) {
            proposalID =
              typeof stateID === "string"
                ? stateID.startsWith("0x")
                  ? stateID.slice(2)
                  : stateID
                : bytesToHex(stateID);
          } else if (outpoint) {
            proposalID = outpoint;
          }
        } else {
          // 如果没有 StateOutput，使用第一个输出的 outpoint
          if (outputs.length > 0) {
            proposalID = outputs[0].outpoint || outputs[0].Outpoint || "";
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空字符串
    }

    return {
      proposalId: proposalID,
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证提案请求
   */
  private validateProposeRequest(request: ProposeRequest): void {
    // 1. 验证地址
    if (request.proposer.length !== 20) {
      throw new Error("Proposer address must be 20 bytes");
    }

    // 2. 验证标题
    if (!request.title || request.title.trim() === "") {
      throw new Error("Title is required");
    }

    // 3. 验证描述
    if (!request.description || request.description.trim() === "") {
      throw new Error("Description is required");
    }

    // 4. 验证投票期限
    const votingPeriod =
      typeof request.votingPeriod === "bigint"
        ? request.votingPeriod
        : BigInt(request.votingPeriod);
    if (votingPeriod <= BigInt(0)) {
      throw new Error("Voting period must be greater than 0");
    }
  }

  /**
   * 投票
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（使用 StateOutput + SingleKeyLock）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   * 8. 解析交易结果，提取 VoteID
   */
  async vote(request: VoteRequest, wallet?: Wallet): Promise<VoteResult> {
    // 1. 参数验证
    this.validateVoteRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.voter)) {
      throw new Error("Wallet address does not match voter address");
    }

    // 4. 在 SDK 层构建交易草稿
    const voteWeight =
      typeof request.voteWeight === "bigint" ? request.voteWeight : BigInt(request.voteWeight);
    const { draft, inputIndex } = await buildVoteDraft(
      this.client,
      request.voter,
      request.proposalId,
      request.choice,
      voteWeight
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      "SIGHASH_ALL"
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Point } = require("@noble/secp256k1");
        const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
        pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error(
          "require is not available. Please use ES module import for @noble/secp256k1"
        );
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: "SIGHASH_ALL",
      pubkey: "0x" + bytesToHex(pubkeyCompressed),
      signature: "0x" + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    // 10. 解析交易结果，提取 VoteID
    let voteID = "";
    try {
      // 查询交易详情
      const txResult = await this.client.call("wes_getTransactionByHash", [sendResult.txHash]);
      if (txResult && typeof txResult === "object") {
        const txData = txResult;
        const outputs = txData.outputs || txData.Outputs || [];

        // 查找 StateOutput（投票通常使用 StateOutput）
        const stateOutputs = this.findStateOutputs(outputs);
        if (stateOutputs.length > 0) {
          // 使用第一个 StateOutput 的 stateID 或 outpoint 作为 VoteID
          const stateOutput = stateOutputs[0];
          const stateID = stateOutput.state_id || stateOutput.stateID;
          const outpoint = stateOutput.outpoint || stateOutput.Outpoint;

          if (stateID) {
            voteID =
              typeof stateID === "string"
                ? stateID.startsWith("0x")
                  ? stateID.slice(2)
                  : stateID
                : bytesToHex(stateID);
          } else if (outpoint) {
            voteID = outpoint;
          }
        } else {
          // 如果没有 StateOutput，使用第一个输出的 outpoint
          if (outputs.length > 0) {
            voteID = outputs[0].outpoint || outputs[0].Outpoint || "";
          }
        }
      }
    } catch (e) {
      // 忽略解析错误，使用空字符串
    }

    return {
      voteId: voteID,
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证投票请求
   */
  private validateVoteRequest(request: VoteRequest): void {
    // 1. 验证地址
    if (request.voter.length !== 20) {
      throw new Error("Voter address must be 20 bytes");
    }

    // 2. 验证提案ID
    if (request.proposalId.length !== 32) {
      throw new Error("Proposal ID must be 32 bytes");
    }

    // 3. 验证投票选择
    if (request.choice < -1 || request.choice > 1) {
      throw new Error("Choice must be 1 (支持), 0 (反对), or -1 (弃权)");
    }

    // 4. 验证投票权重
    const voteWeight =
      typeof request.voteWeight === "bigint" ? request.voteWeight : BigInt(request.voteWeight);
    if (voteWeight <= BigInt(0)) {
      throw new Error("Vote weight must be greater than 0");
    }
  }

  /**
   * 更新参数
   *
   * **流程**：
   * 1. 验证请求参数
   * 2. 验证地址匹配
   * 3. 在 SDK 层构建交易草稿（使用 StateOutput）
   * 4. 计算签名哈希
   * 5. 使用 Wallet 签名哈希
   * 6. 完成交易
   * 7. 提交交易
   *
   * **注意**：
   * - 更新参数通常需要治理投票通过，可能需要先创建提案
   * - 当前实现简化：直接创建参数更新 StateOutput
   */
  async updateParam(request: UpdateParamRequest, wallet?: Wallet): Promise<UpdateParamResult> {
    // 1. 参数验证
    this.validateUpdateParamRequest(request);

    // 2. 获取 Wallet
    const w = this.getWallet(wallet);

    // 3. 验证地址匹配
    if (!this.addressesEqual(w.address, request.proposer)) {
      throw new Error("Wallet address does not match proposer address");
    }

    // 4. 在 SDK 层构建交易草稿
    // TODO: 需要从配置或参数获取验证者地址列表
    // 当前简化：使用提案者地址作为验证者（实际应该查询验证者列表）
    const validatorAddresses = [request.proposer]; // 临时：使用提案者地址
    const threshold = 1; // 临时：需要1个签名

    const { draft, inputIndex } = await buildUpdateParamDraft(
      this.client,
      request.proposer,
      request.paramKey,
      request.paramValue,
      validatorAddresses,
      threshold
    );

    // 5. 计算签名哈希
    const { hash, unsignedTx } = await computeSignatureHashFromDraft(
      this.client,
      draft,
      inputIndex,
      "SIGHASH_ALL"
    );

    // 6. 使用 Wallet 签名哈希
    const signature = w.signHash(hash);

    // 7. 获取压缩公钥
    const publicKey = w.publicKey;
    let pubkeyCompressed: Uint8Array;
    if (publicKey.length === 65) {
      if (typeof require !== "undefined") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Point } = require("@noble/secp256k1");
        const point = Point.fromHex(bytesToHex(publicKey.slice(1)));
        pubkeyCompressed = point.toRawBytes(true);
      } else {
        throw new Error(
          "require is not available. Please use ES module import for @noble/secp256k1"
        );
      }
    } else if (publicKey.length === 33) {
      pubkeyCompressed = publicKey;
    } else {
      throw new Error(`Invalid public key length: ${publicKey.length}`);
    }

    // 8. 完成交易
    const signedTxHex = await finalizeTransactionFromDraft(this.client, {
      draft,
      unsignedTx,
      input_index: inputIndex,
      sighash_type: "SIGHASH_ALL",
      pubkey: "0x" + bytesToHex(pubkeyCompressed),
      signature: "0x" + bytesToHex(signature),
    });

    // 9. 提交交易
    const sendResult = await this.client.sendRawTransaction(signedTxHex);

    if (!sendResult.accepted) {
      throw new Error(`Transaction rejected: ${sendResult.reason || "Unknown reason"}`);
    }

    return {
      txHash: sendResult.txHash,
      success: true,
      blockHeight: undefined, // TODO: 从 sendResult 获取区块高度
    };
  }

  /**
   * 验证更新参数请求
   */
  private validateUpdateParamRequest(request: UpdateParamRequest): void {
    // 1. 验证地址
    if (request.proposer.length !== 20) {
      throw new Error("Proposer address must be 20 bytes");
    }

    // 2. 验证参数键
    if (!request.paramKey || request.paramKey.trim() === "") {
      throw new Error("Key is required");
    }

    // 3. 验证参数值
    if (!request.paramValue || request.paramValue.trim() === "") {
      throw new Error("Param value is required");
    }
  }
}
