/**
 * 简单转账示例
 * 
 * 演示如何使用 WES Client SDK 进行转账操作
 */

import { Client } from '../../src/client/client';
import { TokenService } from '../../src/services/token/service';
import { Wallet } from '../../src/wallet/wallet';
import { hexToAddress } from '../../src/utils/address';

async function main() {
  try {
    console.log('🚀 WES Client SDK - 简单转账示例\n');

    // 1. 初始化客户端
    console.log('1️⃣ 初始化客户端...');
    const client = new Client({
      endpoint: 'http://localhost:8545',
      protocol: 'http',
      debug: true, // 启用调试日志
    });
    console.log('✅ 客户端初始化成功\n');

    // 2. 创建或导入钱包
    console.log('2️⃣ 创建钱包...');
    // 方式1：创建新钱包
    // const wallet = await Wallet.create();
    
    // 方式2：从私钥导入钱包（示例）
    const wallet = await Wallet.fromPrivateKey(
      '0x' + '1'.repeat(64) // 替换为你的私钥
    );
    console.log(`✅ 钱包创建成功`);
    console.log(`   地址: ${wallet.getAddressHex()}\n`);

    // 3. 创建 Token 服务
    console.log('3️⃣ 创建 Token 服务...');
    const tokenService = new TokenService(client, wallet);
    console.log('✅ Token 服务创建成功\n');

    // 4. 执行转账
    console.log('4️⃣ 执行转账...');
    const toAddress = hexToAddress('0x' + '2'.repeat(40)); // 替换为接收方地址
    
    const result = await tokenService.transfer({
      from: wallet.address,
      to: toAddress,
      amount: 1000000, // 1 WES (假设 6 位小数)
      tokenId: null, // null 表示原生币
    });

    console.log('✅ 转账成功！');
    console.log(`   交易哈希: ${result.txHash}`);
    if (result.blockHeight) {
      console.log(`   区块高度: ${result.blockHeight}`);
    }
    console.log();

  } catch (error: any) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export { main };

