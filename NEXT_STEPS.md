# 下一步调试步骤

## ✅ 当前状态

- 最小化插件（test-minimal）：**成功加载** ✅
- 完整插件（release）：**加载失败** ❌

这说明：
1. NapCat 环境正常
2. 插件目录结构正确
3. 问题出在完整插件的代码或依赖上

---

## 🔍 定位问题

### 步骤 1: 查看 Docker 日志

```bash
# 查看实时日志
docker logs -f <容器名>

# 或者查看最近 200 行
docker logs --tail 200 <容器名>

# 搜索错误信息
docker logs <容器名> 2>&1 | grep -i "error"
docker logs <容器名> 2>&1 | grep -i "napcat-plugin-novel-downloader"
```

**重点查找**:
- `Cannot find module` - 缺少依赖
- `SyntaxError` - 语法错误
- `TypeError` - 类型错误
- `ReferenceError` - 引用错误

---

### 步骤 2: 在容器内手动测试

```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 进入插件目录
cd /app/napcat/plugins/napcat-plugin-novel-downloader/

# 测试插件加载
node --input-type=module -e "import('./index.mjs').then(m => console.log('OK:', Object.keys(m))).catch(e => console.error('Error:', e.message, e.stack))"
```

**可能的错误**:

#### 错误 1: Cannot find module 'axios'
```
Error: Cannot find module 'axios'
```

**原因**: 完整插件使用了 axios，但容器中没有安装

**解决方案**: 需要在插件目录安装依赖
```bash
cd /app/napcat/plugins/napcat-plugin-novel-downloader/
npm install axios
```

或者使用包含 node_modules 的完整版本。

#### 错误 2: 其他模块错误

如果提示缺少其他模块，记录下来并告诉我。

---

### 步骤 3: 测试中间版本

我创建了一个中间版本插件（test-intermediate），它：
- 包含完整的插件结构
- 包含配置 UI
- 包含消息处理
- **但不使用外部依赖**（不使用 axios 等）

**测试步骤**:
1. 压缩 `test-intermediate` 目录
2. 安装到 NapCat
3. 查看是否能加载

```bash
# 在宿主机上
cd napcat-plugin-novel-downloader
zip -r test-intermediate.zip test-intermediate/*

# 或 PowerShell
Compress-Archive -Path test-intermediate\* -DestinationPath test-intermediate.zip -Force
```

如果中间版本成功，说明问题是外部依赖。
如果中间版本失败，说明问题是代码逻辑。

---

## 🔧 可能的解决方案

### 方案 1: 安装依赖到容器

```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 进入插件目录
cd /app/napcat/plugins/napcat-plugin-novel-downloader/

# 安装依赖
npm install --production

# 或者只安装必需的
npm install axios
```

### 方案 2: 使用包含 node_modules 的版本

在宿主机上构建包含依赖的版本：

```bash
cd napcat-plugin-novel-downloader

# 删除旧的 release
rm -rf release

# 构建包含依赖的版本
npm run deploy:full
```

**注意**: `deploy:full` 会运行 `npm install`，可能需要几分钟。

然后将 `release` 目录复制到 Docker 容器。

### 方案 3: 重写插件不使用外部依赖

如果 Docker 环境不支持安装依赖，我们可以：
1. 移除 axios，使用 Node.js 内置的 http/https
2. 简化功能，只保留核心功能

---

## 📊 收集信息

请运行以下命令并提供输出：

### 命令 1: 查看错误日志
```bash
docker logs --tail 100 <容器名> 2>&1 | grep -A 5 -B 5 "napcat-plugin-novel-downloader"
```

### 命令 2: 手动测试插件
```bash
docker exec <容器名> sh -c "cd /app/napcat/plugins/napcat-plugin-novel-downloader && node --input-type=module -e \"import('./index.mjs').then(m => console.log('OK')).catch(e => console.error('Error:', e.message))\""
```

### 命令 3: 检查 Node.js 版本
```bash
docker exec <容器名> node --version
```

### 命令 4: 检查插件文件
```bash
docker exec <容器名> ls -lh /app/napcat/plugins/napcat-plugin-novel-downloader/
```

---

## 🎯 预期结果

根据错误信息，我们可以：

1. **如果是 `Cannot find module`**:
   - 在容器内安装依赖
   - 或使用 `deploy:full` 构建包含依赖的版本

2. **如果是语法或逻辑错误**:
   - 修复代码
   - 重新构建

3. **如果是其他错误**:
   - 提供完整的错误信息
   - 我会进一步分析

---

## 📝 下一步行动

请按顺序执行：

1. ✅ 查看 Docker 日志，找到具体错误信息
2. ✅ 在容器内手动测试插件
3. ✅ 测试中间版本插件
4. ✅ 根据错误信息选择解决方案
5. ✅ 提供错误日志给我进一步分析

---

## 💡 快速解决方案

如果你想快速解决，最简单的方法是：

```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 进入插件目录
cd /app/napcat/plugins/napcat-plugin-novel-downloader/

# 安装 axios
npm install axios

# 退出容器
exit

# 重启容器
docker restart <容器名>
```

然后查看插件是否能加载。

---

## 📞 需要帮助

如果以上步骤都无法解决，请提供：

1. Docker 日志中的错误信息
2. 手动测试插件的输出
3. Node.js 版本
4. NapCat 版本

我会根据这些信息提供针对性的解决方案。
