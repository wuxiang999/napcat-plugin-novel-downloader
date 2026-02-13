# 逐步调试指南

## 🎯 目标

找出导致插件加载失败的具体代码。

## ✅ 已知信息

- **test-minimal** (最小版本): ✅ 成功
- **test-intermediate** (中间版本): ❌ 失败
- **完整版本**: ❌ 失败

## 🔍 逐步测试

我创建了两个测试版本来定位问题：

### 测试 1: test-step1.zip

**包含内容**:
- 基本的插件结构
- 配置 UI (使用 NapCatConfig)
- **不使用** EventType

**测试步骤**:
1. 安装 test-step1.zip
2. 重启 NapCat
3. 查看是否加载成功

**如果成功**: 说明 NapCatConfig 没问题，继续测试 step2
**如果失败**: 说明问题在 NapCatConfig，查看日志中的具体错误

---

### 测试 2: test-step2.zip

**包含内容**:
- test-step1 的所有内容
- **添加** EventType 导入和使用

**测试步骤**:
1. 安装 test-step2.zip
2. 重启 NapCat
3. 查看是否加载成功

**如果成功**: 说明 EventType 也没问题
**如果失败**: 说明问题在 EventType 的使用上

---

## 📊 测试结果分析

### 场景 A: step1 成功，step2 失败

**结论**: 问题在于 `EventType` 的导入或使用

**可能原因**:
1. `napcat-types` 模块不存在或版本不兼容
2. `EventType.MESSAGE` 的值不正确
3. Docker 环境中缺少 napcat-types

**解决方案**:
- 不使用 EventType，改用字符串比较：
  ```javascript
  if (event.post_type !== 'message') return;
  ```

### 场景 B: step1 失败

**结论**: 问题在于 `NapCatConfig` 的使用

**可能原因**:
1. NapCatConfig API 调用方式不对
2. 配置 UI 的某个参数有问题
3. 中文字符串导致问题

**解决方案**:
- 简化配置 UI
- 移除中文，只用英文
- 查看具体的错误信息

### 场景 C: step1 和 step2 都成功

**结论**: 问题在于更复杂的代码逻辑

**需要进一步测试**:
- 添加状态管理
- 添加消息处理逻辑
- 添加文件操作

---

## 🐛 查看详细错误

### 在 Docker 中查看日志

```bash
# 实时查看日志
docker logs -f <容器名>

# 查看最近的错误
docker logs --tail 100 <容器名> 2>&1 | grep -i "error"

# 查看插件相关日志
docker logs <容器名> 2>&1 | grep "步骤"
```

### 关键信息

查找日志中的：
- `步骤1: 开始初始化...` - 如果看到这个，说明插件开始加载
- `步骤1: 初始化完成` - 如果看到这个，说明 step1 成功
- `步骤1: 初始化失败:` - 如果看到这个，后面会有错误信息
- `错误堆栈:` - 详细的错误堆栈信息

---

## 📝 报告格式

请按以下格式提供测试结果：

### test-step1 结果

```
状态: [成功/失败]

日志输出:
[粘贴相关日志]

错误信息 (如果有):
[粘贴错误信息]
```

### test-step2 结果

```
状态: [成功/失败]

日志输出:
[粘贴相关日志]

错误信息 (如果有):
[粘贴错误信息]
```

---

## 🔧 常见问题

### 问题 1: 找不到 napcat-types

**错误信息**:
```
Error: Cannot find module 'napcat-types'
```

**解决方案**:
```bash
docker exec <容器名> sh -c "cd /app/napcat/plugins/napcat-plugin-novel-downloader && npm install napcat-types"
```

### 问题 2: NapCatConfig 未定义

**错误信息**:
```
TypeError: Cannot read property 'combine' of undefined
```

**原因**: ctx.NapCatConfig 不存在

**解决方案**: 检查 NapCat 版本是否 >= 4.14.0

### 问题 3: 中文乱码

**错误信息**: 日志中看到乱码

**解决方案**: 文件编码问题，重新下载插件

---

## 💡 快速定位

如果你想快速定位问题，运行这个命令：

```bash
# 在容器内测试 step1
docker exec <容器名> sh -c "cd /app/napcat/plugins/napcat-plugin-novel-downloader && node --input-type=module -e \"
import('./index.mjs').then(m => {
  console.log('✅ 插件加载成功');
  console.log('导出:', Object.keys(m));
}).catch(e => {
  console.error('❌ 插件加载失败');
  console.error('错误:', e.message);
  console.error('堆栈:', e.stack);
})
\""
```

这会直接告诉你插件是否能被 Node.js 加载。

---

## 🎯 下一步

1. 测试 test-step1.zip
2. 查看日志，记录结果
3. 测试 test-step2.zip
4. 查看日志，记录结果
5. 将结果告诉我

根据测试结果，我会提供针对性的解决方案。

---

## 📞 需要的信息

为了帮你解决问题，我需要：

1. **test-step1 的测试结果** (成功/失败)
2. **test-step2 的测试结果** (成功/失败)
3. **Docker 日志中的错误信息**
4. **手动测试命令的输出**

有了这些信息，我就能准确定位问题并提供解决方案！
