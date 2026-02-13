# 调试指南

## 插件加载失败排查步骤

### 1. 检查目录结构

确保插件目录结构正确：
```
NapCat/plugins/napcat-plugin-novel-downloader/
├── index.mjs          # 必须存在
├── package.json       # 必须存在
├── README.md          # 可选
└── LICENSE            # 可选
```

**重要**: 文件夹名必须是 `napcat-plugin-novel-downloader`，不能是其他名字！

### 2. 检查 package.json

打开 `package.json`，确保包含：
```json
{
  "name": "napcat-plugin-novel-downloader",
  "type": "module",
  "main": "index.mjs",
  "napcat": {
    "tags": ["工具", "娱乐"],
    "minVersion": "4.14.0"
  }
}
```

### 3. 检查 NapCat 版本

插件需要 NapCat 4.14.0 或更高版本。

在 NapCat WebUI 中查看版本号。

### 4. 查看详细日志

NapCat 的日志文件通常在：
- Windows: `NapCat/logs/`
- Linux: `~/.napcat/logs/`

查找包含 "napcat-plugin-novel-downloader" 的错误信息。

### 5. 常见错误及解决方案

#### 错误: "Plugin load failed"
**原因**: 插件文件损坏或格式错误
**解决**: 重新下载并解压插件

#### 错误: "Plugin imported but failed to load (check plugin structure)"
**原因**: 
1. package.json 配置错误
2. index.mjs 文件损坏
3. 缺少必需的导出函数

**解决**:
1. 检查 package.json 的 `type` 字段是否为 `"module"`
2. 检查 `main` 字段是否指向 `"index.mjs"`
3. 重新下载插件

#### 错误: "Cannot find module"
**原因**: 缺少依赖
**解决**: 
1. 确保使用的是完整版插件（包含 node_modules）
2. 或者在插件目录运行 `npm install`

### 6. 手动测试插件

在插件目录运行：
```bash
node -e "import('./index.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

应该输出：
```
Exports: [ 'plugin_init', 'plugin_onmessage', 'plugin_cleanup', 'plugin_get_config', 'plugin_set_config', 'plugin_on_config_change', 'plugin_config_ui' ]
```

### 7. 最小化测试

创建一个最小化的测试插件：

`test-plugin/package.json`:
```json
{
  "name": "test-plugin",
  "type": "module",
  "main": "index.mjs"
}
```

`test-plugin/index.mjs`:
```javascript
export const plugin_init = async (ctx) => {
  ctx.logger.info('Test plugin loaded!');
};

export const plugin_config_ui = [];
```

如果这个能加载，说明 NapCat 本身没问题，是我们的插件有问题。

### 8. 联系支持

如果以上步骤都无法解决，请提供：
1. NapCat 版本
2. Node.js 版本
3. 操作系统
4. 完整的错误日志
5. 插件目录的文件列表

提交 Issue: https://github.com/wuxiang999/napcat-plugin-novel-downloader/issues
