# v1.0.5 测试说明

## 修复内容

### ✅ v1.0.4 修复
- 移除 `EventType` 枚举导入
- 使用字符串比较 `event.post_type !== 'message'`
- 插件可以正常启用

### ✅ v1.0.5 修复
- 修复配置页面报错 "d.map is not a function"
- 将 `NapCatConfig.combine()` 改为直接返回数组
- 配置页面可以正常打开

## 测试步骤

### 1. 安装插件
```bash
# 下载 v1.0.5
wget https://github.com/wuxiang999/napcat-plugin-novel-downloader/releases/download/v1.0.5/napcat-plugin-novel-downloader.zip

# 解压
unzip napcat-plugin-novel-downloader.zip

# 复制到 Docker 容器
docker cp napcat-plugin-novel-downloader <容器名>:/app/napcat/plugins/

# 重启容器
docker restart <容器名>
```

### 2. 验证插件启用
- 打开 NapCat WebUI
- 进入插件管理页面
- 查看"小说下载器"插件状态
- 应该显示"已启用"或可以启用

### 3. 验证配置页面
- 点击插件的"配置"按钮
- 应该能正常打开配置页面
- 不应该出现 "d.map is not a function" 错误
- 应该能看到以下配置项：
  - 启用插件
  - 👑 权限设置
  - 管理员QQ
  - 📊 下载限制
  - 每日下载限制
  - 最大章节限制
  - ⚙️ 性能设置
  - 最大并发任务
  - API并发数
  - 📁 存储设置
  - 下载目录
  - 输出格式（TXT/EPUB/HTML）
  - 🔧 调试选项
  - 调试模式

### 4. 功能测试
在 QQ 中发送以下命令：

```
小说帮助
```

应该收到帮助信息回复，包含：
- 搜索小说 <书名>
- 小说详情 <ID>
- 下载小说 <ID>
- 下载进度
- 取消下载
- 小说帮助

## 预期结果

✅ 插件可以正常启用  
✅ 配置页面可以正常打开  
✅ 配置项显示正常  
✅ 命令可以正常响应  

## 如果还有问题

请提供以下信息：

1. **Docker 日志**
   ```bash
   docker logs --tail 100 <容器名>
   ```

2. **插件文件列表**
   ```bash
   docker exec <容器名> ls -la /app/napcat/plugins/napcat-plugin-novel-downloader/
   ```

3. **错误截图**
   - 插件列表页面
   - 配置页面（如果能打开）
   - 错误信息

## 版本历史

- **v1.0.5** (2024-02-13) - 修复配置页面报错
- **v1.0.4** (2024-02-13) - 修复插件加载失败
- **v1.0.3** - 初始版本

## 技术细节

### 问题分析

1. **EventType 导入问题**
   - `napcat-types` 在 Docker 环境中可能不可用
   - 枚举导入会导致模块加载失败
   - 解决：使用字符串字面量

2. **配置 Schema 格式问题**
   - `NapCatConfig.combine()` 返回的不是数组
   - WebUI 期望 `plugin_config_ui` 是数组
   - 解决：直接返回数组而不是 combine 结果

### 构建配置

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: ['napcat-types', 'fs', 'path', 'http', 'https', 'crypto'],
    },
    minify: false,  // 禁用压缩以保留中文
  },
});
```

### 关键代码

```typescript
// src/index.ts
export const plugin_onmessage = async (ctx, event) => {
  // ✅ 使用字符串比较
  if (event.post_type !== 'message') return;
  if (!pluginState.config.enabled) return;
  await handleMessage(ctx, event);
};

// src/config.ts
export function buildConfigSchema(ctx) {
  const { NapCatConfig } = ctx;
  // ✅ 直接返回数组
  return [
    NapCatConfig.boolean('enabled', '启用插件', true),
    NapCatConfig.text('adminQQ', '管理员QQ', ''),
    // ...
  ];
}
```

---

**祝测试顺利！** 📚✨
