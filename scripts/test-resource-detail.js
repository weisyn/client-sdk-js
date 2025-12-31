/**
 * 测试资源详情 SDK 返回字段
 * 
 * 验证：
 * 1. deployBlockHeight 是否存在
 * 2. executionConfig 是否存在及格式
 * 3. lockingConditions 是否存在及格式
 * 4. getResourceHistory 是否可用
 */

const { createClient, ResourceService } = require('../dist/index.js');

const NODE_URL = process.env.WES_NODE_URL || 'http://localhost:28680';

async function testResourceDetail() {
  console.log('=== 测试资源详情 SDK 返回字段 ===\n');
  console.log(`[Test] Connecting to WES node: ${NODE_URL}\n`);

  // 1. 初始化客户端
  const client = createClient({
    endpoint: NODE_URL,
    protocol: 'http',
    timeout: 30000,
  });
  const resourceService = new ResourceService(client);

  try {
    // 2. 获取资源列表
    console.log('1. 调用 listResources...');
    const resources = await resourceService.listResources({ limit: 10 });
    console.log(`   找到 ${resources.length} 个资源\n`);

    if (resources.length === 0) {
      console.log('❌ 没有找到资源，无法测试');
      return;
    }

    // 3. 检查第一个资源（假设是可执行资源）
    const resource = resources[0];
    console.log('2. 检查资源字段：');
    console.log(`   - contentHash: ${resource.contentHash}`);
    console.log(`   - category: ${resource.category}`);
    console.log(`   - executableType: ${resource.executableType || 'N/A'}`);
    console.log(`   - deployBlockHeight: ${resource.deployBlockHeight || '❌ MISSING'}`);
    console.log(`   - deployBlockHash: ${resource.deployBlockHash || '❌ MISSING'}`);
    console.log(`   - deployTimestamp: ${resource.deployTimestamp || '❌ MISSING'}`);
    console.log(`   - executionConfig: ${resource.executionConfig ? '✅ EXISTS' : '❌ MISSING'}`);
    if (resource.executionConfig) {
      console.log(`     - type: ${resource.executionConfig.type}`);
      if (resource.executionConfig.type === 'contract') {
        console.log(`     - exportedFunctions: ${JSON.stringify(resource.executionConfig.config?.exportedFunctions || [])}`);
        console.log(`     - abiVersion: ${resource.executionConfig.config?.abiVersion || 'N/A'}`);
      } else if (resource.executionConfig.type === 'aimodel') {
        console.log(`     - inputNames: ${JSON.stringify(resource.executionConfig.config?.inputNames || [])}`);
        console.log(`     - outputNames: ${JSON.stringify(resource.executionConfig.config?.outputNames || [])}`);
        console.log(`     - modelFormat: ${resource.executionConfig.config?.modelFormat || 'N/A'}`);
      }
    }
    console.log(`   - lockingConditions: ${resource.lockingConditions ? `✅ EXISTS (${resource.lockingConditions.length} items)` : '❌ MISSING'}`);
    if (resource.lockingConditions && resource.lockingConditions.length > 0) {
      resource.lockingConditions.forEach((lc, idx) => {
        console.log(`     [${idx}] type: ${lc.type || 'unknown'}`);
      });
    }
    console.log(`   - originalFilename: ${resource.originalFilename || '❌ MISSING'}`);
    console.log(`   - fileExtension: ${resource.fileExtension || '❌ MISSING'}`);
    console.log(`   - creationContext: ${resource.creationContext || '❌ MISSING'}`);
    console.log(`   - deployMemo: ${resource.deployMemo || '❌ MISSING'}`);
    console.log(`   - deployTags: ${JSON.stringify(resource.deployTags || [])}`);
    console.log('');

    // 4. 测试 getResourceHistory（如果资源是可执行的）
    if (resource.category === 'EXECUTABLE' && resource.contentHash) {
      console.log('3. 测试 getResourceHistory...');
      try {
        const contentHashBytes = Buffer.from(resource.contentHash.replace(/^0x/, ''), 'hex');
        if (contentHashBytes.length !== 32) {
          console.log('   ⚠️  contentHash 长度不正确，跳过历史查询');
        } else {
          const history = await resourceService.getResourceHistory(contentHashBytes, 0, 10);
          console.log(`   ✅ getResourceHistory 调用成功`);
          console.log(`   - deployTx: ${history.deployTx ? '✅ EXISTS' : '❌ MISSING'}`);
          if (history.deployTx) {
            console.log(`     - txId: ${history.deployTx.txId}`);
            console.log(`     - blockHeight: ${history.deployTx.blockHeight || '❌ MISSING'}`);
            console.log(`     - timestamp: ${history.deployTx.timestamp || '❌ MISSING'}`);
          }
          console.log(`   - upgrades: ${history.upgrades ? `✅ EXISTS (${history.upgrades.length} items)` : '❌ MISSING'}`);
          console.log(`   - referencesSummary: ${history.referencesSummary ? '✅ EXISTS' : '❌ MISSING'}`);
          if (history.referencesSummary) {
            console.log(`     - totalReferences: ${history.referencesSummary.totalReferences || 0}`);
            console.log(`     - uniqueCallers: ${history.referencesSummary.uniqueCallers || 0}`);
            console.log(`     - lastReferenceTime: ${history.referencesSummary.lastReferenceTime || 0}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ getResourceHistory 调用失败: ${error.message}`);
      }
      console.log('');
    }

    // 5. 输出完整的资源对象（用于调试）
    console.log('4. 完整资源对象（JSON）：');
    console.log(JSON.stringify(resource, null, 2));

    // 关闭连接
    await client.close();
    console.log('\n✅ 测试完成');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testResourceDetail().catch(console.error);

