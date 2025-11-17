# GitHub 仓库说明

本目录包含 GitHub 相关的配置文件。

## 工作流

- **ci.yml** - CI 工作流（测试、构建、代码检查）
- **publish.yml** - 发布工作流（npm 发布）

## 使用说明

### CI 工作流

每次 push 到 main/develop 分支或创建 PR 时自动运行：
- 代码检查（lint）
- 格式化检查
- 单元测试
- 构建验证

### 发布工作流

创建 GitHub Release 时自动发布到 npm：
- 构建项目
- 发布到 npm registry

---

**最后更新**: 2025-01-23

