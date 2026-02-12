# 发布指南

本文档详细说明如何将插件发布到 NapCat 官方插件市场。

## 📋 前提条件

- ✅ 插件代码已开发完成
- ✅ 可以正常构建（`pnpm run build`）
- ✅ 有 GitHub 账号
- ✅ 已将代码推送到 GitHub 仓库

## 🚀 发布流程

### 第一步：配置 GitHub Secrets

1. **进入仓库设置**
   - 打开你的 GitHub 仓库
   - 点击 `Settings` > `Secrets and variables` > `Actions`

2. **创建 Personal Access Token (PAT)**
   
   **方式一：Classic Token（推荐，简单快速）**
   
   a. 访问 https://github.com/settings/tokens
   
   b. 点击 `Generate new token (classic)`
   
   c. 填写信息：
      - Note: `napcat-plugin-index`
      - Expiration: 选择合适的过期时间（建议 90 天或更长）
      - 勾选权限：
        - ✅ `public_repo`（在 repo 下）
   
   d. 点击 `Generate token`，立即复制 Token（只显示一次！）

3. **添加 Secret 到仓库**
   
   a. 回到插件仓库的 Settings > Secrets and variables > Actions
   
   b. 点击 `New repository secret`
   
   c. 添加以下 Secret：
      - Name: `INDEX_PAT`
      - Value: 粘贴刚才复制的 Token
   
   d. 点击 `Add secret`

### 第二步：发布插件

#### 方式一：通过 Git Tag 发布（推荐）

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: 准备发布 v1.0.0"
git push

# 2. 创建并推送 tag
git tag v1.0.0
git push origin v1.0.0
```

#### 方式二：手动触发工作流

1. 进入仓库的 `Actions` 标签页
2. 选择 `Build and Release` 工作流
3. 点击 `Run workflow`
4. 输入版本号（如 `v1.0.0`）
5. 点击 `Run workflow`

### 第三步：等待自动化流程完成

推送 tag 后，CI 会自动执行以下步骤：

1. ✅ 构建项目
2. ✅ 打包 zip 文件
3. ✅ 创建 GitHub Release
4. ✅ 上传 zip 到 Release
5. ✅ 自动 fork 插件索引仓库
6. ✅ 更新 plugins.v4.json
7. ✅ 提交 PR 到官方索引仓库

你可以在 `Actions` 标签页查看工作流执行状态。



### 第四步：等待审核

PR 提交后，索引仓库会自动进行审核：

1. **自动校验**（几秒内完成）
   - JSON 格式检查
   - 字段完整性验证
   - 下载链接可达性测试
   - 插件 ID 规范检查

2. **AI 安全审计**（1-2 分钟）
   - 下载插件 zip
   - 静态代码分析
   - 检测高危代码

3. **人工审核**（如需要）
   - 低风险 PR 可能自动合并
   - 高风险 PR 需要维护者审核

审核结果会在 PR 评论中显示。

## 🔧 可选配置

### AI 自动生成 Release Note

如果你想让 AI 自动生成更专业的 Release Note，可以配置以下 Secrets：

| Secret 名称 | 必填 | 说明 |
|------------|------|------|
| `AI_API_URL` | 是 | OpenAI 兼容的 API 地址 |
| `AI_API_KEY` | 是 | API 密钥 |
| `AI_MODEL` | 否 | 模型名称（默认 gpt-4o-mini） |

**示例配置：**

- AI_API_URL: `https://api.openai.com/v1/chat/completions`
- AI_API_KEY: `sk-...`
- AI_MODEL: `gpt-4o-mini`

**自定义 AI Prompt：**

编辑 `.github/prompt/release_note_prompt.txt` 文件来自定义 AI 生成的风格。

## 📝 版本更新

后续版本更新流程完全相同：

```bash
# 1. 修改代码
git add .
git commit -m "feat: 添加新功能"

# 2. 更新版本号（可选，CI 会以 tag 为准）
# 编辑 package.json 中的 version

# 3. 推送新 tag
git tag v1.1.0
git push origin v1.1.0
```

CI 会自动完成构建、发布、更新索引的全部流程。

## ❓ 常见问题

### Q: INDEX_PAT Token 过期了怎么办？

重新生成一个新的 PAT，更新仓库 Secret 即可。

### Q: 提交 PR 时报 403 错误？

检查以下几点：
1. PAT 权限是否正确（需要 `public_repo`）
2. PAT 是否已过期
3. 工作流文件是否是最新版本

### Q: Release 发布了但索引没更新？

1. 检查 Actions 页面的 `update-index.yml` 运行日志
2. 常见原因：
   - INDEX_PAT 未配置或已过期
   - 下载链接验证失败（等待 30 秒后会自动重试）
   - package.json 缺少必要字段

### Q: 下载链接验证失败？

GitHub Release 资源上传可能有延迟。CI 已内置 30 秒重试机制。如果仍失败，可以等资源上传完成后手动触发 `update-index.yml` 工作流。

### Q: 如何查看工作流执行日志？

1. 进入仓库的 `Actions` 标签页
2. 点击对应的工作流运行记录
3. 展开各个步骤查看详细日志

## 📊 发布检查清单

发布前请确认：

- [ ] `package.json` 中的 `name` 以 `napcat-plugin-` 开头
- [ ] `package.json` 中的 `plugin` 字段已填写（显示名称）
- [ ] `package.json` 中的 `description` 已填写
- [ ] `package.json` 中的 `author` 已填写
- [ ] `napcat.tags` 已设置（如 `["工具", "娱乐"]`）
- [ ] `napcat.minVersion` 已设置（如 `"4.14.0"`）
- [ ] 代码可以正常构建（`pnpm run build`）
- [ ] 已配置 `INDEX_PAT` Secret
- [ ] 已推送代码到 GitHub

## 🎉 发布成功后

1. 你的插件会出现在 NapCat 插件市场
2. 用户可以通过 WebUI 搜索并安装
3. 后续版本更新会自动同步到插件市场

## 📚 相关文档

- [NapCat 插件开发文档](https://napneko.github.io/develop/plugin/)
- [插件发布官方文档](https://napneko.github.io/develop/plugin/publish)
- [插件索引仓库](https://github.com/NapNeko/napcat-plugin-index)

---

**祝你发布顺利！** 🚀

如有问题，欢迎在 [Issues](https://github.com/wuxiang999/napcat-plugin-novel-downloader/issues) 中反馈。
