# NapCat 小说下载插件

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.2-green.svg)](https://github.com/wuxiang999/napcat-plugin-novel-downloader/releases)
[![NapCat](https://img.shields.io/badge/NapCat-%3E%3D4.14.0-orange.svg)](https://napcat.napneko.icu/)

一个功能强大的 NapCat 小说下载插件，支持七猫小说平台的搜索和下载。

## ✨ 特性

- 🚀 **高速下载** - 采用高并发架构，下载速度可达 350 章/秒
- 📚 **七猫小说** - 完整支持七猫小说平台
- 📄 **多格式支持** - 支持 TXT、HTML、EPUB 三种格式
- 👑 **权限管理** - 管理员和群主无限制，普通用户每日限额
- 📊 **实时进度** - 下载过程中实时显示进度和速度
- 📁 **群文件集成** - 自动上传到 QQ 群文件
- 🎨 **美化卡片** - 精美的消息卡片展示
- ⚙️ **灵活配置** - WebUI 可视化配置

## 📦 安装

### 方式一：通过 NapCat WebUI（推荐）

1. 打开 NapCat WebUI
2. 进入插件市场
3. 搜索"小说下载器"
4. 点击安装

### 方式二：手动安装

```bash
# 下载最新版本
wget https://github.com/wuxiang999/napcat-plugin-novel-downloader/releases/latest/download/napcat-plugin-novel-downloader.zip

# 解压到插件目录
unzip napcat-plugin-novel-downloader.zip -d /path/to/napcat/plugins/

# 重启 NapCat
```

## 🚀 快速开始

### 基本命令

```
搜索小说 <书名>    # 搜索小说
小说详情 <ID>      # 查看书籍详情
下载小说 <ID>      # 下载小说
下载进度           # 查看当前下载进度
取消下载           # 取消当前下载任务
小说帮助           # 查看帮助信息
```

### 使用示例

```
用户: 搜索小说 斗破苍穹
机器人: 📚 搜索结果 (共3个):
        1. 斗破苍穹
           作者: 天蚕土豆
           来源: 七猫
           ID: 123456

用户: 下载小说 123456
机器人: 📥 正在准备下载...
        ✅ 下载完成！
```

## ⚙️ 配置

在 NapCat WebUI 中配置以下参数：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| enabled | true | 是否启用插件 |
| adminQQ | [] | 管理员QQ号列表 |
| dailyLimit | 5 | 普通用户每日下载限制 |
| vipDailyLimit | 20 | VIP用户每日下载限制 |
| maxChapterLimit | 500 | 单本小说最大章节数 |
| downloadDir | ./novels | 下载目录 |
| maxConcurrentTasks | 3 | 最大并发任务数 |
| apiConcurrency | 350 | API并发数 |
| debug | false | 调试模式 |

## 🙏 鸣谢

本项目参考了以下开源项目：

- [swiftcat-downloader-flutter](https://github.com/shing-yu/swiftcat-downloader-flutter) - 七猫小说 API 实现参考

感谢开源社区的贡献！

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

## 👤 作者

**LANHU199**

## 🔗 相关链接

- [使用文档](./USAGE.md)
- [贡献指南](./CONTRIBUTING.md)
- [更新日志](./CHANGELOG.md)
- [问题反馈](https://github.com/wuxiang999/napcat-plugin-novel-downloader/issues)

## ⚠️ 免责声明

本插件仅供学习交流使用，请勿用于商业用途。使用本插件下载的内容，请遵守相关法律法规和平台规则。

---

**Made with ❤️ by LANHU199**
