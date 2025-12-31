/**
 * 简单的资源列表测试脚本（Node.js，无需 TypeScript）
 * 
 * 用于验证 SDK 能否正确获取和解析资源数据
 * 
 * 运行方式：
 *   node scripts/test-resource-list.js
 */

const { createClient, ResourceService } = require('../dist/index.js');

const NODE_URL = process.env.WES_NODE_URL || 'http://localhost:28680';

async function testResourceList() {
  console.log(`[Test] Connecting to WES node: ${NODE_URL}`);
  
  try {
    // 创建客户端
    const client = createClient({
      endpoint: NODE_URL,
      protocol: 'http',
      timeout: 30000,
    });
    
    // 创建 ResourceService（不需要 wallet）
    const resourceService = new ResourceService(client);
    
    console.log('[Test] Calling listResources()...');
    
    // 获取资源列表
    const resources = await resourceService.listResources({});
    
    console.log(`\n[Test] ✅ Successfully got ${resources.length} resources\n`);
    
    if (resources.length === 0) {
      console.log('[Test] ⚠️  No resources found on node');
      console.log('[Test] This is OK - the node may not have any resources yet');
      await client.close();
      return;
    }
    
    // 打印每个资源的详细信息
    resources.forEach((resource, index) => {
      console.log(`[Test] Resource #${index + 1}:`);
      console.log(`  - category: ${resource.category} (should be EXECUTABLE or STATIC)`);
      console.log(`  - executableType: ${resource.executableType || 'N/A'} (should be CONTRACT or AI_MODEL if category is EXECUTABLE)`);
      console.log(`  - contentHash: ${resource.contentHash}`);
      console.log(`  - mimeType: ${resource.mimeType}`);
      console.log(`  - size: ${resource.size} bytes`);
      console.log(`  - owner: ${resource.owner}`);
      console.log('');
      
      // 验证字段格式
      const issues = [];
      
      // 检查 category 格式
      if (resource.category.includes('RESOURCE_CATEGORY_')) {
        issues.push(`❌ category is in protocol format: ${resource.category} (should be EXECUTABLE or STATIC)`);
      } else if (!['EXECUTABLE', 'STATIC'].includes(resource.category)) {
        issues.push(`❌ category has unexpected value: ${resource.category}`);
      } else {
        console.log(`  ✅ category format is correct: ${resource.category}`);
      }
      
      // 检查 executableType 格式（如果是可执行资源）
      if (resource.category === 'EXECUTABLE') {
        if (!resource.executableType) {
          issues.push(`❌ executableType is missing for EXECUTABLE resource`);
        } else if (resource.executableType.includes('EXECUTABLE_TYPE_')) {
          issues.push(`❌ executableType is in protocol format: ${resource.executableType} (should be CONTRACT or AI_MODEL)`);
        } else if (!['CONTRACT', 'AI_MODEL'].includes(resource.executableType)) {
          issues.push(`❌ executableType has unexpected value: ${resource.executableType}`);
        } else {
          console.log(`  ✅ executableType format is correct: ${resource.executableType}`);
        }
      }
      
      if (issues.length > 0) {
        console.log(`  ⚠️  Issues found:`);
        issues.forEach(issue => console.log(`    ${issue}`));
      }
    });
    
    // 关闭连接
    await client.close();
    
    console.log('[Test] ✅ Test completed successfully');
    
  } catch (error) {
    console.error('[Test] ❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('[Test] Error message:', error.message);
      console.error('[Test] Stack:', error.stack);
    }
    process.exit(1);
  }
}

// 运行测试
testResourceList().catch(console.error);

