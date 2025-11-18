/**
 * Jest 自定义模块解析器
 * 用于处理 ESM 模块（如 @noble/secp256k1）
 * 
 * Jest 30 对 ESM 模块的支持仍然有限，这个 resolver 尝试通过
 * 修改 package.json 的解析来强制 Jest 使用 CommonJS 版本
 */
module.exports = (request, options) => {
  const defaultResolver = options.defaultResolver;
  
  // 对于 @noble/secp256k1 和 js-sha3，尝试特殊处理
  if (request.startsWith('@noble/secp256k1') || request.startsWith('js-sha3')) {
    try {
      // 尝试解析模块
      const resolved = defaultResolver(request, {
        ...options,
        packageFilter: (pkg) => {
          // 如果包是 ESM 模块，尝试移除 type: "module"
          // 这样 Jest 会尝试将其作为 CommonJS 处理
          if (pkg.type === 'module') {
            // 创建一个新的 package.json 对象，移除 type 字段
            const newPkg = { ...pkg };
            delete newPkg.type;
            return newPkg;
          }
          return pkg;
        },
      });
      return resolved;
    } catch (error) {
      // 如果解析失败，回退到默认解析器
      return defaultResolver(request, options);
    }
  }
  
  // 其他模块使用默认解析器
  return defaultResolver(request, options);
};

