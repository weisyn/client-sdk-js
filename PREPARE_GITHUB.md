# GitHub 发布准备清单

**版本**：1.0  
**状态**：draft  
**最后更新**：2025-01-23  
**所有者**：WES SDK 团队

---

## ✅ 准备工作清单

### 1. 代码清理

- [x] 删除过渡性文档（SUMMARY.md, IMPLEMENTATION_STATUS.md）
- [x] 更新 README.md，添加仓库链接
- [x] 添加 .gitattributes
- [x] 添加 .npmignore
- [x] 添加 CONTRIBUTING.md

### 2. 文档关联

- [x] 在 README.md 中添加 Go SDK 链接
- [x] 在 Go SDK README.md 中添加 JS/TS SDK 链接
- [x] 创建 RELATED_SDKS.md 文档
- [x] 更新两个 SDK 的 README，添加 SDK 对比表

### 3. GitHub 配置

- [x] CI/CD 工作流（.github/workflows/ci.yml）
- [x] 发布工作流（.github/workflows/publish.yml）
- [x] package.json 中的仓库信息

### 4. 发布前检查

- [ ] 运行 `npm install` 安装依赖
- [ ] 运行 `npm run build` 测试构建
- [ ] 运行 `npm test` 运行测试
- [ ] 运行 `npm run lint` 检查代码
- [ ] 检查所有文档链接有效
- [ ] 确认 LICENSE 文件存在

---

## 🚀 发布步骤

### Step 1: 创建 GitHub 仓库

1. 在 GitHub 上创建仓库：`weisyn/client-sdk-js`
2. 设置为公开仓库
3. 添加仓库描述：`WES 区块链客户端开发工具包 - JavaScript/TypeScript 版本`

### Step 2: 初始化 Git 仓库

```bash
cd /Users/qinglong/go/src/chaincodes/WES/sdk/client-sdk-js

# 初始化 Git（如果还没有）
git init

# 添加远程仓库
git remote add origin https://github.com/weisyn/client-sdk-js.git

# 添加所有文件
git add .

# 提交
git commit -S -m "feat: initial commit - WES Client SDK for JavaScript/TypeScript"

# 推送到 GitHub
git push -u origin main
```

### Step 3: 配置 GitHub 仓库

1. **设置仓库主题**：`wes`, `blockchain`, `sdk`, `typescript`, `javascript`
2. **添加仓库描述**：`WES 区块链客户端开发工具包 - JavaScript/TypeScript 版本`
3. **设置默认分支**：`main`
4. **启用 Issues** 和 **Pull Requests**

### Step 4: 创建第一个 Release

1. 创建标签：`v0.1.0-alpha`
2. 创建 Release，包含：
   - 版本号：`v0.1.0-alpha`
   - 标题：`Initial Release - Alpha Version`
   - 描述：从 CHANGELOG.md 复制内容

### Step 5: 配置 npm 发布（可选）

如果需要发布到 npm：

1. 创建 npm 账号（如果还没有）
2. 在 GitHub Secrets 中添加 `NPM_TOKEN`
3. 创建 Release 时会自动发布到 npm

---

## 📋 仓库信息

- **仓库名**: `weisyn/client-sdk-js`
- **完整 URL**: `https://github.com/weisyn/client-sdk-js`
- **npm 包名**: `@weisyn/client-sdk-js`
- **许可证**: Apache-2.0

---

## 🔗 关联仓库

- **Go SDK**: [github.com/weisyn/client-sdk-go](https://github.com/weisyn/client-sdk-go)
- **Contract SDK**: [github.com/weisyn/contract-sdk-go](https://github.com/weisyn/contract-sdk-go)
- **WES 主项目**: [github.com/weisyn/weisyn-core](https://github.com/weisyn/weisyn-core)

---

**最后更新**: 2025-01-23

