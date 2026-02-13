# Docker 环境调试指南

## 📋 查看 NapCat 日志

### 方法 1: 实时查看日志
```bash
# 查看容器实时日志
docker logs -f <容器名或ID>

# 例如：
docker logs -f napcat
```

### 方法 2: 查看最近的日志
```bash
# 查看最后 100 行日志
docker logs --tail 100 <容器名或ID>

# 查看最后 500 行日志
docker logs --tail 500 napcat
```

### 方法 3: 进入容器查看日志文件
```bash
# 进入容器
docker exec -it <容器名或ID> /bin/bash
# 或者
docker exec -it <容器名或ID> /bin/sh

# 查看日志目录
cd /app/napcat/logs
# 或
cd /usr/src/app/logs

# 列出日志文件
ls -lh

# 查看最新日志
tail -f *.log

# 搜索错误
grep -i "error" *.log
grep -i "napcat-plugin-novel-downloader" *.log
```

### 方法 4: 复制日志文件到本地
```bash
# 复制整个日志目录
docker cp <容器名>:/app/napcat/logs ./napcat-logs

# 复制单个日志文件
docker cp <容器名>:/app/napcat/logs/napcat.log ./napcat.log
```

---

## 🔍 查找插件加载错误

### 搜索插件相关日志
```bash
# 在容器内搜索
docker exec <容器名> grep -r "napcat-plugin-novel-downloader" /app/napcat/logs/

# 搜索错误信息
docker exec <容器名> grep -r "Plugin load failed" /app/napcat/logs/

# 搜索所有错误
docker exec <容器名> grep -r "ERROR" /app/napcat/logs/
```

---

## 📂 查看插件目录

### 检查插件是否正确安装
```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 查看插件目录
ls -la /app/napcat/plugins/napcat-plugin-novel-downloader/

# 查看 package.json
cat /app/napcat/plugins/napcat-plugin-novel-downloader/package.json

# 查看 index.mjs 前几行
head -n 20 /app/napcat/plugins/napcat-plugin-novel-downloader/index.mjs
```

---

## 🧪 在容器内测试插件

### 手动加载插件测试
```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 进入插件目录
cd /app/napcat/plugins/napcat-plugin-novel-downloader/

# 测试插件是否能被 Node.js 加载
node --input-type=module -e "import('./index.mjs').then(m => console.log('Exports:', Object.keys(m))).catch(e => console.error('Error:', e))"
```

**期望输出**:
```
Exports: [ 'plugin_init', 'plugin_onmessage', 'plugin_cleanup', 'plugin_get_config', 'plugin_set_config', 'plugin_on_config_change', 'plugin_config_ui' ]
```

**如果报错**，记录完整的错误信息。

---

## 🐛 常见问题排查

### 问题 1: 找不到日志目录

不同的 NapCat Docker 镜像日志位置可能不同：

```bash
# 尝试这些位置
/app/napcat/logs
/usr/src/app/logs
/app/logs
/napcat/logs
~/.napcat/logs
```

### 问题 2: 权限问题

```bash
# 检查文件权限
docker exec <容器名> ls -la /app/napcat/plugins/napcat-plugin-novel-downloader/

# 如果权限不对，修复权限
docker exec <容器名> chmod -R 755 /app/napcat/plugins/napcat-plugin-novel-downloader/
```

### 问题 3: 文件编码问题

```bash
# 检查文件编码
docker exec <容器名> file /app/napcat/plugins/napcat-plugin-novel-downloader/index.mjs

# 应该显示: UTF-8 Unicode text
```

---

## 📝 收集调试信息

运行以下命令收集完整的调试信息：

```bash
#!/bin/bash
CONTAINER_NAME="napcat"  # 替换为你的容器名

echo "=== NapCat 版本 ==="
docker exec $CONTAINER_NAME node --version

echo -e "\n=== 插件目录结构 ==="
docker exec $CONTAINER_NAME ls -la /app/napcat/plugins/napcat-plugin-novel-downloader/

echo -e "\n=== package.json 内容 ==="
docker exec $CONTAINER_NAME cat /app/napcat/plugins/napcat-plugin-novel-downloader/package.json

echo -e "\n=== 最近的日志 ==="
docker logs --tail 200 $CONTAINER_NAME

echo -e "\n=== 插件相关错误 ==="
docker exec $CONTAINER_NAME grep -r "napcat-plugin-novel-downloader" /app/napcat/logs/ 2>/dev/null || echo "未找到日志文件"

echo -e "\n=== 手动测试插件 ==="
docker exec $CONTAINER_NAME sh -c "cd /app/napcat/plugins/napcat-plugin-novel-downloader && node --input-type=module -e \"import('./index.mjs').then(m => console.log('OK:', Object.keys(m))).catch(e => console.error('Error:', e.message))\""
```

保存为 `debug.sh`，然后运行：
```bash
chmod +x debug.sh
./debug.sh > debug-output.txt 2>&1
```

---

## 🔧 可能的问题和解决方案

### 问题: 缺少 Node.js 模块

**症状**: 日志显示 `Cannot find module 'axios'` 或类似错误

**原因**: 完整插件依赖了外部模块，但 Docker 容器中没有安装

**解决方案 1**: 使用包含 node_modules 的完整版本
```bash
# 在宿主机上
cd napcat-plugin-novel-downloader
npm run deploy:full  # 这会安装依赖到 release 目录

# 然后将 release 目录复制到 Docker 容器
```

**解决方案 2**: 在容器内安装依赖
```bash
# 进入容器
docker exec -it <容器名> /bin/sh

# 进入插件目录
cd /app/napcat/plugins/napcat-plugin-novel-downloader/

# 安装依赖
npm install --production
```

### 问题: 文件过大

**症状**: 插件文件很大（> 100KB），加载缓慢或失败

**原因**: 打包了不必要的依赖

**解决方案**: 使用精简版本（只包含必要的代码）

---

## 📊 性能监控

### 查看容器资源使用
```bash
# 查看容器资源使用情况
docker stats <容器名>

# 查看容器详细信息
docker inspect <容器名>
```

---

## 🔄 重启容器

如果修改了插件，需要重启容器：

```bash
# 重启容器
docker restart <容器名>

# 或者停止后启动
docker stop <容器名>
docker start <容器名>
```

---

## 💡 调试技巧

### 1. 启用详细日志

在 NapCat 配置中启用调试模式（如果支持）

### 2. 逐步测试

1. 先测试最小化插件（已成功 ✅）
2. 逐步添加功能，找出哪个部分导致失败
3. 检查是否是某个特定的依赖或代码导致问题

### 3. 对比工作的插件

如果有其他能正常工作的插件，对比它们的：
- 文件大小
- package.json 格式
- 依赖情况
- 代码结构

---

## 📞 需要帮助？

请提供以下信息：

1. **Docker 镜像**: `docker images | grep napcat`
2. **容器信息**: `docker ps -a | grep napcat`
3. **Node.js 版本**: `docker exec <容器名> node --version`
4. **插件目录**: `docker exec <容器名> ls -la /app/napcat/plugins/napcat-plugin-novel-downloader/`
5. **错误日志**: 运行上面的 `debug.sh` 脚本的输出
6. **手动测试结果**: 在容器内运行 node 命令的输出

提交 Issue: https://github.com/wuxiang999/napcat-plugin-novel-downloader/issues
