# 故障排查指南

## 🔍 插件加载失败的完整诊断流程

### 问题现象
```
Plugin load failed: napcat-plugin-novel-downloader
```

或

```
Plugin imported but failed to load (check plugin structure)
```

---

## 📋 诊断步骤

### 步骤 1: 验证 NapCat 版本

**要求**: NapCat >= 4.14.0

在 NapCat WebUI 中查看版本号。如果版本过低，请升级 NapCat。

---

### 步骤 2: 测试最小化插件

我们提供了一个最小化测试插件 `test-minimal.zip`，用于验证 NapCat 是否能加载任何插件。

**安装步骤**:
1. 解压 `test-minimal.zip`
2. 将解压后的文件放到 `NapCat/plugins/napcat-plugin-novel-downloader/`
3. 重启 NapCat
4. 查看是否还显示加载失败

**如果最小化插件也失败**:
- 说明 NapCat 本身有问题或配置不正确
- 检查 NapCat 日志文件
- 尝试重新安装 NapCat

**如果最小化插件成功**:
- 说明完整插件有问题
- 继续下面的步骤

---

### 步骤 3: 检查目录结构

**正确的目录结构**:
```
NapCat/
└── plugins/
    └── napcat-plugin-novel-downloader/    ← 文件夹名必须完全一致
        ├── index.mjs                       ← 必须存在
        ├── package.json                    ← 必须存在
        ├── README.md                       ← 可选
        └── LICENSE                         ← 可选
```

**常见错误**:
- ❌ 文件夹名错误（如 `novel-downloader`、`napcat-plugin-novel-downloader-main`）
- ❌ 多了一层目录（如 `plugins/napcat-plugin-novel-downloader/napcat-plugin-novel-downloader/`）
- ❌ 缺少 `index.mjs` 或 `package.json`

---

### 步骤 4: 验证 package.json

打开 `package.json`，确保包含以下字段：

```json
{
  "name": "napcat-plugin-novel-downloader",
  "type": "module",
  "main": "index.mjs",
  "napcat": {
    "minVersion": "4.14.0"
  }
}
```

**必须检查**:
- ✅ `type` 必须是 `"module"`
- ✅ `main` 必须是 `"index.mjs"`
- ✅ `name` 必须是 `"napcat-plugin-novel-downloader"`

---

### 步骤 5: 检查文件编码

**问题**: 如果 `index.mjs` 包含中文但编码不是 UTF-8，会导致加载失败。

**验证方法**:
1. 用文本编辑器打开 `index.mjs`
2. 查看文件编码是否为 UTF-8
3. 如果不是，转换为 UTF-8 编码

**PowerShell 命令**:
```powershell
Get-Content index.mjs -Encoding UTF8 | Set-Content index.mjs -Encoding UTF8
```

---

### 步骤 6: 查看 NapCat 日志

**日志位置**:
- Windows: `NapCat/logs/`
- Linux: `~/.napcat/logs/`

**查找关键信息**:
```bash
# 搜索插件相关错误
grep -i "napcat-plugin-novel-downloader" logs/*.log
grep -i "plugin load" logs/*.log
grep -i "error" logs/*.log
```

**常见错误信息**:
1. `Cannot find module` - 缺少依赖
2. `SyntaxError` - 语法错误
3. `TypeError` - 类型错误
4. `ENOENT` - 文件不存在

---

### 步骤 7: 手动测试插件

在插件目录运行：

```bash
node --input-type=module -e "import('./index.mjs').then(m => console.log('Exports:', Object.keys(m)))"
```

**期望输出**:
```
Exports: [ 'plugin_init', 'plugin_onmessage', 'plugin_cleanup', 'plugin_get_config', 'plugin_set_config', 'plugin_on_config_change', 'plugin_config_ui' ]
```

**如果报错**:
- 记录错误信息
- 检查是否缺少 Node.js 模块
- 检查 Node.js 版本（需要 >= 16）

---

### 步骤 8: 检查依赖

我们的插件使用了以下 Node.js 内置模块：
- `fs`
- `path`
- `crypto`
- `http`
- `https`

这些都是内置模块，不需要安装。

**如果 NapCat 提示缺少模块**:
- 可能是 NapCat 的 Node.js 环境有问题
- 尝试重新安装 NapCat

---

### 步骤 9: 对比工作的插件

如果你有其他能正常工作的 NapCat 插件：

1. 对比目录结构
2. 对比 `package.json` 格式
3. 对比文件权限
4. 查看是否有特殊配置

---

### 步骤 10: 清理缓存

有时 NapCat 会缓存旧的插件信息：

1. 完全关闭 NapCat
2. 删除插件目录
3. 清理 NapCat 缓存（如果有）
4. 重新安装插件
5. 启动 NapCat

---

## 🐛 已知问题

### 问题 1: 中文乱码
**症状**: 插件加载失败，日志中看到乱码
**原因**: 文件编码不是 UTF-8
**解决**: 使用 v1.0.3 或更高版本（已禁用压缩）

### 问题 2: 依赖冲突
**症状**: 提示找不到模块
**原因**: package.json 中包含了 dependencies
**解决**: 使用 v1.0.3 或更高版本（已移除 dependencies）

### 问题 3: 权限问题
**症状**: Windows 上提示权限错误
**原因**: 文件被占用或权限不足
**解决**: 
- 以管理员身份运行 NapCat
- 检查杀毒软件是否拦截
- 关闭其他可能占用文件的程序

---

## 📞 获取帮助

如果以上步骤都无法解决问题，请提供以下信息：

1. **NapCat 版本**: 
2. **Node.js 版本**: `node --version`
3. **操作系统**: Windows/Linux/macOS + 版本
4. **插件版本**: 
5. **目录结构**: 
   ```
   ls -la NapCat/plugins/napcat-plugin-novel-downloader/
   ```
6. **package.json 内容**:
   ```json
   (粘贴完整内容)
   ```
7. **错误日志**:
   ```
   (粘贴相关日志)
   ```
8. **手动测试结果**:
   ```
   (粘贴 node 命令的输出)
   ```

**提交 Issue**: https://github.com/wuxiang999/napcat-plugin-novel-downloader/issues

---

## ✅ 成功标志

插件加载成功后，你应该看到：

1. NapCat WebUI 中显示"小说下载器"插件
2. 插件状态为"已启用"或可以启用
3. 可以打开插件配置界面
4. 配置界面中文显示正常
5. 在 QQ 中发送命令有响应

**测试命令**:
```
小说帮助
```

应该收到帮助信息回复。

---

## 🔧 开发者信息

如果你是开发者想要调试插件：

1. 克隆仓库
2. 安装依赖: `npm install`
3. 构建: `npm run build`
4. 打包: `npm run deploy`
5. 将 `release/` 目录内容复制到 NapCat 插件目录
6. 查看 NapCat 日志进行调试

**启用调试模式**:
在插件配置中开启"调试模式"，会输出详细日志。
