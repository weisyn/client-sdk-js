# 贡献指南

感谢您对 WES Client SDK (JS/TS) 的关注！

---

## 🤝 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 查看 [Issues](https://github.com/weisyn/client-sdk-js/issues) 确认问题是否已存在
2. 如果不存在，创建新的 Issue，包含：
   - 问题描述
   - 复现步骤
   - 预期行为
   - 实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. **Fork 仓库**
2. **创建分支**：`git checkout -b feature/your-feature-name`
3. **提交更改**：`git commit -S -m "feat: your feature description"`
4. **推送分支**：`git push origin feature/your-feature-name`
5. **创建 Pull Request**

### 代码规范

- ✅ 使用 TypeScript
- ✅ 遵循 ESLint 规则
- ✅ 编写单元测试
- ✅ 更新相关文档
- ✅ 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

### 开发流程

```bash
# 1. 克隆仓库
git clone https://github.com/weisyn/client-sdk-js.git
cd client-sdk-js

# 2. 安装依赖
npm install

# 3. 运行测试
npm test

# 4. 运行代码检查
npm run lint

# 5. 构建项目
npm run build
```

---

## 📝 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**：
```
feat(token): add batch transfer support

Implement batch transfer functionality for Token service.
Supports multiple transfers in a single transaction.

Closes #123
```

---

## ✅ 检查清单

提交 PR 前请确认：

- [ ] 代码通过 ESLint 检查
- [ ] 代码通过格式化检查
- [ ] 所有测试通过
- [ ] 添加了新功能的测试
- [ ] 更新了相关文档
- [ ] 提交信息符合规范

---

## 🔗 相关资源

- [Go Client SDK](https://github.com/weisyn/client-sdk-go) - 参考实现
- [WES 主项目](https://github.com/weisyn/weisyn-core) - WES 区块链核心

---



