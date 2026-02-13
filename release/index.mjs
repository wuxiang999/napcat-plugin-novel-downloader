import { EventType } from "napcat-types";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import axios from "axios";
import http from "http";
import https from "https";
const defaultConfig = {
  enabled: true,
  adminQQ: [],
  dailyLimit: 5,
  maxChapterLimit: 500,
  downloadDir: "./novels",
  maxConcurrentTasks: 3,
  apiConcurrency: 350,
  outputFormat: "txt",
  debug: false
};
function buildConfigSchema(ctx) {
  const { NapCatConfig } = ctx;
  return NapCatConfig.combine(
    NapCatConfig.boolean("enabled", "启用插件", true, "是否启用小说下载功能"),
    NapCatConfig.html("<h3>👑 权限设置</h3>"),
    NapCatConfig.text("adminQQ", "管理员QQ", "", "多个QQ号用逗号分隔，管理员和群主无下载限制"),
    NapCatConfig.html("<h3>📊 下载限制</h3>"),
    NapCatConfig.number("dailyLimit", "每日下载限制", 5, "普通用户每日可下载小说数量（管理员和群主无限制）"),
    NapCatConfig.number("maxChapterLimit", "最大章节限制", 500, "单本小说最大章节数（防止下载超大小说）"),
    NapCatConfig.html("<h3>⚙️ 性能设置</h3>"),
    NapCatConfig.number("maxConcurrentTasks", "最大并发任务", 3, "同时进行的下载任务数"),
    NapCatConfig.number("apiConcurrency", "API并发数", 350, "单个任务的章节并发下载数"),
    NapCatConfig.html("<h3>📁 存储设置</h3>"),
    NapCatConfig.text("downloadDir", "下载目录", "./novels", "小说文件保存目录"),
    NapCatConfig.select("outputFormat", "输出格式", "txt", "小说文件输出格式", [
      { label: "TXT 文本", value: "txt" },
      { label: "EPUB 电子书", value: "epub" },
      { label: "HTML 网页", value: "html" }
    ]),
    NapCatConfig.html("<h3>🔧 调试选项</h3>"),
    NapCatConfig.boolean("debug", "调试模式", false, "开启后显示详细日志")
  );
}
class PluginState {
  constructor() {
    this.config = { ...defaultConfig };
    this.userData = /* @__PURE__ */ new Map();
    this.userDataPath = "";
    this.activeDownloads = /* @__PURE__ */ new Map();
  }
  /**
   * 初始化状态
   */
  init(ctx) {
    this.ctx = ctx;
    this.loadConfig();
    this.loadUserData();
  }
  /**
   * 加载配置
   */
  loadConfig() {
    try {
      const configPath = path.join(this.ctx.configPath, "config.json");
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, "utf-8");
        this.config = { ...defaultConfig, ...JSON.parse(data) };
      } else {
        this.saveConfig();
      }
    } catch (error) {
      this.ctx.logger.error("加载配置失败:", error);
      this.config = { ...defaultConfig };
    }
  }
  /**
   * 保存配置
   */
  saveConfig() {
    try {
      const configPath = path.join(this.ctx.configPath, "config.json");
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      this.ctx.logger.error("保存配置失败:", error);
    }
  }
  /**
   * 更新配置（合并）
   */
  updateConfig(partial) {
    this.config = { ...this.config, ...partial };
    this.saveConfig();
  }
  /**
   * 替换配置（完整替换）
   */
  replaceConfig(config) {
    this.config = config;
    this.saveConfig();
  }
  /**
   * 加载用户数据
   */
  loadUserData() {
    try {
      this.userDataPath = path.join(this.ctx.dataPath, "users.json");
      if (fs.existsSync(this.userDataPath)) {
        const data = fs.readFileSync(this.userDataPath, "utf-8");
        const parsed = JSON.parse(data);
        this.userData = new Map(Object.entries(parsed));
      }
    } catch (error) {
      this.ctx.logger.error("加载用户数据失败:", error);
    }
  }
  /**
   * 保存用户数据
   */
  saveUserData() {
    try {
      const dir = path.dirname(this.userDataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.userData);
      fs.writeFileSync(this.userDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.ctx.logger.error("保存用户数据失败:", error);
    }
  }
  /**
   * 获取用户数据
   */
  getUser(userId) {
    if (!this.userData.has(userId)) {
      const newUser = {
        userId,
        downloadCount: 0,
        lastDownloadDate: ""
      };
      this.userData.set(userId, newUser);
      this.saveUserData();
    }
    return this.userData.get(userId);
  }
  /**
   * 更新用户数据
   */
  updateUser(userId, data) {
    const user = this.getUser(userId);
    Object.assign(user, data);
    this.userData.set(userId, user);
    this.saveUserData();
  }
  /**
   * 检查用户是否可以下载
   */
  canUserDownload(userId, isGroupOwner = false) {
    if (this.config.adminQQ.includes(userId) || isGroupOwner) {
      return { allowed: true };
    }
    const user = this.getUser(userId);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (user.lastDownloadDate !== today) {
      user.downloadCount = 0;
      user.lastDownloadDate = today;
      this.updateUser(userId, user);
    }
    if (user.downloadCount >= this.config.dailyLimit) {
      return {
        allowed: false,
        reason: `今日下载次数已达上限 (${this.config.dailyLimit}次)`
      };
    }
    return { allowed: true };
  }
  /**
   * 增加用户下载计数
   */
  incrementDownloadCount(userId) {
    const user = this.getUser(userId);
    user.downloadCount++;
    this.updateUser(userId, user);
  }
  /**
   * 清理资源
   */
  cleanup() {
    for (const task of this.activeDownloads.values()) {
      task.abortController.abort();
    }
    this.activeDownloads.clear();
  }
  /**
   * 日志方法
   */
  get logger() {
    return this.ctx.logger;
  }
}
const pluginState = new PluginState();
const SIGN_KEY = "d3dGiJc651gSQ8w1";
const AES_KEY_HEX = "32343263636238323330643730396531";
const BASE_URL_BC = "https://api-bc.wtzw.com";
const BASE_URL_KS = "https://api-ks.wtzw.com";
const VERSION_LIST = [
  "73720",
  "73700",
  "73620",
  "73600",
  "73500",
  "73420",
  "73400",
  "73328",
  "73325",
  "73320",
  "73300",
  "73220",
  "73200",
  "73100",
  "73000",
  "72900",
  "72820",
  "72800",
  "70720",
  "62010",
  "62112"
];
class QimaoApiClient {
  constructor() {
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 350
    });
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 350,
      rejectUnauthorized: false
    });
    this.axiosInstance = axios.create({
      timeout: 15e3,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*"
      },
      httpAgent,
      httpsAgent
    });
  }
  /**
   * 生成 API 请求签名
   */
  generateSignature(params, key) {
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys.map((k) => `${k}=${params[k]}`).join("") + key;
    return crypto.createHash("md5").update(signStr, "utf8").digest("hex");
  }
  /**
   * 生成 API 请求头
   */
  getHeaders(bookId) {
    const seed = this.hashCode(bookId);
    const version = VERSION_LIST[Math.abs(seed) % VERSION_LIST.length];
    const headers = {
      "AUTHORIZATION": "",
      "app-version": version,
      "application-id": "com.****.reader",
      "channel": "unknown",
      "net-env": "1",
      "platform": "android",
      "qm-params": "",
      "reg": "0"
    };
    headers["sign"] = this.generateSignature(headers, SIGN_KEY);
    return headers;
  }
  /**
   * 字符串哈希函数（模拟 Java hashCode）
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }
  /**
   * 搜索小说
   */
  async searchBooks(keyword) {
    var _a;
    const params = {
      "extend": "",
      "tab": "0",
      "gender": "0",
      "refresh_state": "8",
      "page": "1",
      "wd": keyword,
      "is_short_story_user": "0"
    };
    params["sign"] = this.generateSignature(params, SIGN_KEY);
    try {
      const response = await this.axiosInstance.get(`${BASE_URL_BC}/search/v1/words`, {
        params,
        headers: this.getHeaders("00000000")
      });
      if (response.status === 200 && ((_a = response.data) == null ? void 0 : _a.data)) {
        const books = response.data.data.books || [];
        return books.filter((json) => json.id && json.id.toString().trim()).map((json) => ({
          id: json.id.toString(),
          title: this.removeHtmlTags(json.title || "无书名"),
          author: this.removeHtmlTags(json.author || "未知作者"),
          isOver: json.is_over === "1"
        }));
      }
      return [];
    } catch (error) {
      console.error("[七猫] 搜索失败:", error);
      return [];
    }
  }
  /**
   * 获取书籍详情
   */
  async fetchBookInfo(bookId) {
    var _a, _b;
    const params = {
      "id": bookId,
      "imei_ip": "2937357107",
      "teeny_mode": "0"
    };
    params["sign"] = this.generateSignature(params, SIGN_KEY);
    try {
      const response = await this.axiosInstance.get(`${BASE_URL_BC}/api/v4/book/detail`, {
        params,
        headers: this.getHeaders(bookId)
      });
      if (response.status === 200 && ((_a = response.data) == null ? void 0 : _a.data)) {
        const bookData = response.data.data.book;
        const tagList = bookData.book_tag_list || [];
        return {
          id: ((_b = bookData.id) == null ? void 0 : _b.toString()) || "",
          title: bookData.title || "未知标题",
          author: bookData.author || "未知作者",
          intro: bookData.intro || "暂无简介",
          wordsNum: parseInt(bookData.words_num) || 0,
          tags: tagList.map((tag) => tag.title).join(", "),
          imgUrl: bookData.image_link || "",
          isOver: bookData.is_over === "1"
        };
      }
      return null;
    } catch (error) {
      console.error("[七猫] 获取书籍详情失败:", error);
      return null;
    }
  }
  /**
   * 获取章节列表
   */
  async fetchChapterList(bookId) {
    var _a, _b;
    const params = {
      "chapter_ver": "0",
      "id": bookId
    };
    params["sign"] = this.generateSignature(params, SIGN_KEY);
    try {
      const response = await this.axiosInstance.get(`${BASE_URL_KS}/api/v1/chapter/chapter-list`, {
        params,
        headers: this.getHeaders(bookId)
      });
      if (response.status === 200 && ((_b = (_a = response.data) == null ? void 0 : _a.data) == null ? void 0 : _b.chapter_lists)) {
        const chaptersJson = response.data.data.chapter_lists;
        chaptersJson.sort((a, b) => a.chapter_sort - b.chapter_sort);
        return chaptersJson.map((json) => {
          var _a2;
          return {
            id: ((_a2 = json.id) == null ? void 0 : _a2.toString()) || "",
            title: json.title || "未知章节",
            sort: parseInt(json.chapter_sort) || 0
          };
        });
      }
      return [];
    } catch (error) {
      console.error("[七猫] 获取章节列表失败:", error);
      return [];
    }
  }
  /**
   * 获取章节内容
   */
  async fetchChapterContent(bookId, chapterId) {
    var _a;
    const params = {
      "chapter_id": chapterId,
      "id": bookId
    };
    params["sign"] = this.generateSignature(params, SIGN_KEY);
    try {
      const response = await this.axiosInstance.get(`${BASE_URL_KS}/api/v1/chapter/content`, {
        params,
        headers: this.getHeaders(bookId)
      });
      if (response.status === 200 && ((_a = response.data) == null ? void 0 : _a.data)) {
        const content = response.data.data.content;
        if (content && typeof content === "string") {
          try {
            return this.decryptChapterContent(content);
          } catch {
            return content;
          }
        }
        return content || "";
      }
      return "";
    } catch (error) {
      console.error("[七猫] 获取章节内容失败:", error);
      return "";
    }
  }
  /**
   * 解密章节内容
   */
  decryptChapterContent(encryptedContent) {
    try {
      const encryptedBytes = Buffer.from(encryptedContent, "base64");
      const iv = encryptedBytes.slice(0, 16);
      const encrypted = encryptedBytes.slice(16);
      const key = Buffer.from(AES_KEY_HEX, "hex");
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, iv);
      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    } catch (error) {
      console.error("[七猫] 解密失败:", error);
      return encryptedContent;
    }
  }
  /**
   * 移除 HTML 标签
   */
  removeHtmlTags(htmlText) {
    return htmlText.replace(/<[^>]*>/g, "");
  }
}
class NovelDownloader {
  constructor() {
    this.qimaoClient = new QimaoApiClient();
  }
  /**
   * 搜索小说
   */
  async searchNovel(keyword) {
    try {
      const results = await this.qimaoClient.searchBooks(keyword);
      return results.map((book) => ({
        book_id: book.id,
        book_name: book.title,
        author: book.author,
        source: "七猫",
        status: book.isOver ? "已完结" : "连载中"
      }));
    } catch (error) {
      pluginState.logger.error("搜索失败:", error);
      return [];
    }
  }
  /**
   * 获取书籍详情
   */
  async getBookInfo(bookId) {
    try {
      const book = await this.qimaoClient.fetchBookInfo(bookId);
      if (!book) return null;
      return {
        book_id: book.id,
        book_name: book.title,
        author: book.author,
        source: "七猫",
        status: book.isOver ? "已完结" : "连载中",
        abstract: book.intro,
        word_number: book.wordsNum > 0 ? `${(book.wordsNum / 1e4).toFixed(1)}万字` : "",
        thumb_url: book.imgUrl,
        category: book.tags
      };
    } catch (error) {
      pluginState.logger.error("获取书籍信息失败:", error);
      return null;
    }
  }
  /**
   * 开始下载
   */
  async startDownload(ctx, userId, groupId, bookId, onProgress) {
    try {
      const bookInfo = await this.getBookInfo(bookId);
      if (!bookInfo) {
        throw new Error("无法获取书籍信息");
      }
      const qimaoChapters = await this.qimaoClient.fetchChapterList(bookId);
      if (qimaoChapters.length === 0) {
        throw new Error("无法获取章节列表");
      }
      const chapters = qimaoChapters.map((ch, index) => ({
        index,
        item_id: ch.id,
        chapter_id: ch.id,
        title: ch.title,
        downloaded: false
      }));
      if (chapters.length > pluginState.config.maxChapterLimit) {
        throw new Error(`章节数超过限制 (${chapters.length}/${pluginState.config.maxChapterLimit})`);
      }
      const task = {
        user_id: userId,
        group_id: groupId,
        book_info: bookInfo,
        status: {
          totalChapters: chapters.length,
          downloadedChapters: 0,
          failedChapters: 0,
          progress: 0,
          status: "downloading",
          startTime: Date.now(),
          avgSpeed: 0,
          estimatedTime: 0
        },
        chapters,
        tempFile: "",
        isPaused: false,
        abortController: new AbortController()
      };
      pluginState.activeDownloads.set(userId, task);
      await this.downloadChapters(task, bookId);
      const filePath = await this.generateFile(task);
      if (groupId) {
        await this.uploadToGroup(ctx, groupId, filePath, bookInfo.book_name);
      }
      task.status.status = "completed";
      task.status.endTime = Date.now();
      onProgress(task.status);
      pluginState.activeDownloads.delete(userId);
    } catch (error) {
      pluginState.logger.error("下载失败:", error);
      const task = pluginState.activeDownloads.get(userId);
      if (task) {
        task.status.status = "failed";
        task.status.error = String(error);
        onProgress(task.status);
        pluginState.activeDownloads.delete(userId);
      }
      throw error;
    }
  }
  /**
   * 下载章节内容
   */
  async downloadChapters(task, bookId) {
    const concurrency = pluginState.config.apiConcurrency;
    const chunks = [];
    for (let i = 0; i < task.chapters.length; i += concurrency) {
      chunks.push(task.chapters.slice(i, i + concurrency));
    }
    for (const chunk of chunks) {
      if (task.abortController.signal.aborted) {
        throw new Error("下载已取消");
      }
      await Promise.all(
        chunk.map(async (chapter) => {
          try {
            const content = await this.qimaoClient.fetchChapterContent(bookId, chapter.chapter_id);
            chapter.content = content;
            chapter.downloaded = true;
            task.status.downloadedChapters++;
            task.status.progress = task.status.downloadedChapters / task.status.totalChapters * 100;
            const elapsed = (Date.now() - task.status.startTime) / 1e3;
            task.status.avgSpeed = task.status.downloadedChapters / elapsed;
            task.status.estimatedTime = (task.status.totalChapters - task.status.downloadedChapters) / task.status.avgSpeed;
          } catch (error) {
            chapter.downloaded = false;
            chapter.error = String(error);
            task.status.failedChapters++;
          }
        })
      );
    }
  }
  /**
   * 生成文件
   */
  async generateFile(task) {
    const dir = pluginState.config.downloadDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const format = pluginState.config.outputFormat;
    const baseName = `${task.book_info.book_name}_${task.book_info.author}`;
    let filePath;
    switch (format) {
      case "epub":
        filePath = await this.generateEpub(task, dir, baseName);
        break;
      case "html":
        filePath = await this.generateHtml(task, dir, baseName);
        break;
      default:
        filePath = await this.generateTxt(task, dir, baseName);
    }
    task.tempFile = filePath;
    return filePath;
  }
  /**
   * 生成 TXT 文件
   */
  async generateTxt(task, dir, baseName) {
    const filePath = path.join(dir, `${baseName}.txt`);
    let content = `${task.book_info.book_name}
`;
    content += `作者: ${task.book_info.author}
`;
    content += `来源: ${task.book_info.source}
`;
    if (task.book_info.status) content += `状态: ${task.book_info.status}
`;
    if (task.book_info.word_number) content += `字数: ${task.book_info.word_number}
`;
    content += `
${"=".repeat(50)}

`;
    for (const chapter of task.chapters) {
      if (chapter.downloaded && chapter.content) {
        content += `
${chapter.title}

`;
        content += `${chapter.content}

`;
      }
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }
  /**
   * 生成 HTML 文件
   */
  async generateHtml(task, dir, baseName) {
    const filePath = path.join(dir, `${baseName}.html`);
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${task.book_info.book_name}</title>
  <style>
    body { font-family: "Microsoft YaHei", Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.8; }
    .book-info { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .book-title { font-size: 2em; font-weight: bold; margin-bottom: 10px; }
    .book-meta { color: #666; margin: 5px 0; }
    .chapter { margin: 30px 0; }
    .chapter-title { font-size: 1.5em; font-weight: bold; margin: 20px 0; border-left: 4px solid #007bff; padding-left: 10px; }
    .chapter-content { text-indent: 2em; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="book-info">
    <div class="book-title">${task.book_info.book_name}</div>
    <div class="book-meta">作者: ${task.book_info.author}</div>
    <div class="book-meta">来源: ${task.book_info.source}</div>`;
    if (task.book_info.status) html += `
    <div class="book-meta">状态: ${task.book_info.status}</div>`;
    if (task.book_info.word_number) html += `
    <div class="book-meta">字数: ${task.book_info.word_number}</div>`;
    if (task.book_info.abstract) html += `
    <div class="book-meta">简介: ${task.book_info.abstract}</div>`;
    html += `
  </div>
`;
    for (const chapter of task.chapters) {
      if (chapter.downloaded && chapter.content) {
        const escapedTitle = this.escapeHtml(chapter.title);
        const escapedContent = this.escapeHtml(chapter.content);
        html += `  <div class="chapter">
    <div class="chapter-title">${escapedTitle}</div>
    <div class="chapter-content">${escapedContent}</div>
  </div>
`;
      }
    }
    html += `</body>
</html>`;
    fs.writeFileSync(filePath, html, "utf-8");
    return filePath;
  }
  /**
   * 生成 EPUB 文件
   */
  async generateEpub(task, dir, baseName) {
    pluginState.logger.warn("EPUB 格式暂未完全实现，将生成 TXT 格式");
    return await this.generateTxt(task, dir, baseName);
  }
  /**
   * HTML 转义
   */
  escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  /**
   * 上传到群文件
   */
  async uploadToGroup(ctx, groupId, filePath, fileName) {
    try {
      const ext = path.extname(filePath);
      await ctx.actions.call("upload_group_file", {
        group_id: groupId,
        file: filePath,
        name: `${fileName}${ext}`
      }, ctx.adapterName, ctx.pluginManager.config);
    } catch (error) {
      pluginState.logger.error("上传群文件失败:", error);
      throw error;
    }
  }
}
const downloader = new NovelDownloader();
async function handleMessage(ctx, event) {
  var _a;
  const message = ((_a = event.raw_message) == null ? void 0 : _a.trim()) || "";
  const userId = String(event.user_id);
  const groupId = event.message_type === "group" ? String(event.group_id) : "";
  let isGroupOwner = false;
  if (groupId && event.sender) {
    isGroupOwner = event.sender.role === "owner";
  }
  if (message.startsWith("搜索小说 ") || message.startsWith("搜小说 ")) {
    const keyword = message.replace(/^(搜索小说|搜小说)\s+/, "").trim();
    if (!keyword) {
      await sendMessage(ctx, event, "❌ 请输入搜索关键词\n用法: 搜索小说 书名");
      return;
    }
    await sendMessage(ctx, event, "🔍 正在搜索...");
    try {
      const results = await downloader.searchNovel(keyword);
      if (results.length === 0) {
        await sendMessage(ctx, event, "❌ 未找到相关小说");
        return;
      }
      let reply = `📚 搜索结果 (共${results.length}个):

`;
      results.slice(0, 5).forEach((book, index) => {
        reply += `${index + 1}. ${book.book_name}
`;
        reply += `   作者: ${book.author}
`;
        if (book.status) reply += `   状态: ${book.status}
`;
        reply += `   ID: ${book.book_id}

`;
      });
      reply += '💡 发送 "下载小说 书籍ID" 开始下载';
      await sendMessage(ctx, event, reply);
    } catch (error) {
      pluginState.logger.error("搜索失败:", error);
      await sendMessage(ctx, event, "❌ 搜索失败，请稍后重试");
    }
    return;
  }
  if (message.startsWith("小说详情 ") || message.startsWith("书籍详情 ")) {
    const bookId = message.replace(/^(小说详情|书籍详情)\s+/, "").trim();
    if (!bookId) {
      await sendMessage(ctx, event, "❌ 请输入书籍ID\n用法: 小说详情 书籍ID");
      return;
    }
    await sendMessage(ctx, event, "📖 正在获取详情...");
    try {
      const bookInfo = await downloader.getBookInfo(bookId);
      if (!bookInfo) {
        await sendMessage(ctx, event, "❌ 未找到该小说");
        return;
      }
      let card = `━━━━━━━━━━━━━━━━━━
`;
      card += `📚 ${bookInfo.book_name}
`;
      card += `━━━━━━━━━━━━━━━━━━

`;
      card += `✍️ 作者: ${bookInfo.author}
`;
      card += `📖 来源: ${bookInfo.source}
`;
      if (bookInfo.status) card += `📊 状态: ${bookInfo.status}
`;
      if (bookInfo.word_number) card += `📝 字数: ${bookInfo.word_number}
`;
      if (bookInfo.category) card += `🏷️ 分类: ${bookInfo.category}
`;
      if (bookInfo.abstract) {
        card += `
📄 简介:
${bookInfo.abstract.substring(0, 100)}${bookInfo.abstract.length > 100 ? "..." : ""}
`;
      }
      card += `
━━━━━━━━━━━━━━━━━━
`;
      card += `💡 发送 "下载小说 ${bookId}" 开始下载`;
      await sendMessage(ctx, event, card);
    } catch (error) {
      pluginState.logger.error("获取详情失败:", error);
      await sendMessage(ctx, event, "❌ 获取详情失败，请稍后重试");
    }
    return;
  }
  if (message.startsWith("下载小说 ") || message.startsWith("下小说 ")) {
    const input = message.replace(/^(下载小说|下小说)\s+/, "").trim();
    if (!input) {
      await sendMessage(ctx, event, "❌ 请输入书籍ID\n用法: 下载小说 书籍ID");
      return;
    }
    const check = pluginState.canUserDownload(userId, isGroupOwner);
    if (!check.allowed) {
      await sendMessage(ctx, event, `❌ ${check.reason}`);
      return;
    }
    if (pluginState.activeDownloads.has(userId)) {
      await sendMessage(ctx, event, '❌ 您已有正在进行的下载任务\n发送 "下载进度" 查看进度');
      return;
    }
    const bookId = input.split(/\s+/)[0];
    await sendMessage(ctx, event, "📖 正在获取书籍信息...");
    try {
      const bookInfo = await downloader.getBookInfo(bookId);
      if (!bookInfo) {
        await sendMessage(ctx, event, "❌ 未找到该小说");
        return;
      }
      let card = `━━━━━━━━━━━━━━━━━━
`;
      card += `📚 ${bookInfo.book_name}
`;
      card += `━━━━━━━━━━━━━━━━━━

`;
      card += `✍️ 作者: ${bookInfo.author}
`;
      card += `📖 来源: ${bookInfo.source}
`;
      if (bookInfo.status) card += `📊 状态: ${bookInfo.status}
`;
      if (bookInfo.word_number) card += `📝 字数: ${bookInfo.word_number}
`;
      if (bookInfo.category) card += `🏷️ 分类: ${bookInfo.category}
`;
      card += `
📥 开始下载中，请稍候...
`;
      card += `━━━━━━━━━━━━━━━━━━`;
      await sendMessage(ctx, event, card);
      await downloader.startDownload(ctx, userId, groupId, bookId, (progress) => {
        if (progress.status === "completed") {
          const duration = Math.round((Date.now() - progress.startTime) / 1e3);
          let successMsg = `✅ 下载完成！

`;
          successMsg += `📚 书名: ${bookInfo.book_name}
`;
          successMsg += `✍️ 作者: ${bookInfo.author}
`;
          successMsg += `📖 章节: ${progress.totalChapters} 章
`;
          successMsg += `⏱️ 用时: ${duration}秒
`;
          successMsg += `📁 格式: ${pluginState.config.outputFormat.toUpperCase()}`;
          sendMessage(ctx, event, successMsg);
        } else if (progress.status === "failed") {
          sendMessage(ctx, event, `❌ 下载失败: ${progress.error}`);
        }
      });
      pluginState.incrementDownloadCount(userId);
    } catch (error) {
      pluginState.logger.error("下载失败:", error);
      await sendMessage(ctx, event, `❌ 下载失败: ${error}`);
    }
    return;
  }
  if (message === "下载进度" || message === "进度") {
    const task = pluginState.activeDownloads.get(userId);
    if (!task) {
      await sendMessage(ctx, event, "❌ 当前没有下载任务");
      return;
    }
    const { status } = task;
    let reply = `━━━━━━━━━━━━━━━━━━
`;
    reply += `📊 下载进度
`;
    reply += `━━━━━━━━━━━━━━━━━━

`;
    reply += `📚 书名: ${task.book_info.book_name}
`;
    reply += `✍️ 作者: ${task.book_info.author}
`;
    reply += `📈 进度: ${status.downloadedChapters}/${status.totalChapters} (${status.progress.toFixed(1)}%)
`;
    reply += `⚡ 速度: ${status.avgSpeed.toFixed(1)} 章/秒
`;
    reply += `⏱️ 预计剩余: ${Math.round(status.estimatedTime)}秒
`;
    reply += `📊 状态: ${getStatusText(status.status)}
`;
    reply += `━━━━━━━━━━━━━━━━━━`;
    await sendMessage(ctx, event, reply);
    return;
  }
  if (message === "取消下载" || message === "停止下载") {
    const task = pluginState.activeDownloads.get(userId);
    if (!task) {
      await sendMessage(ctx, event, "❌ 当前没有下载任务");
      return;
    }
    task.abortController.abort();
    pluginState.activeDownloads.delete(userId);
    await sendMessage(ctx, event, "✅ 已取消下载");
    return;
  }
  if (message === "小说帮助" || message === "小说菜单" || message === "小说下载帮助") {
    const help = `━━━━━━━━━━━━━━━━━━
📚 小说下载插件
━━━━━━━━━━━━━━━━━━

🔍 搜索小说 <书名> - 搜索小说
📖 小说详情 <ID> - 查看详情
📥 下载小说 <ID> - 下载小说
📊 下载进度 - 查看进度
❌ 取消下载 - 取消任务

━━━━━━━━━━━━━━━━━━
📖 支持平台: 七猫小说
📁 支持格式: TXT, EPUB, HTML
👑 管理员和群主无下载限制
━━━━━━━━━━━━━━━━━━`;
    await sendMessage(ctx, event, help);
    return;
  }
}
async function sendMessage(ctx, event, text) {
  try {
    await ctx.actions.call("send_msg", {
      message: text,
      message_type: event.message_type,
      ...event.message_type === "group" ? { group_id: String(event.group_id) } : {},
      ...event.message_type === "private" ? { user_id: String(event.user_id) } : {}
    }, ctx.adapterName, ctx.pluginManager.config);
  } catch (error) {
    ctx.logger.error("发送消息失败:", error);
  }
}
function getStatusText(status) {
  const statusMap = {
    pending: "⏳ 等待中",
    downloading: "⬇️ 下载中",
    paused: "⏸️ 已暂停",
    completed: "✅ 已完成",
    failed: "❌ 失败",
    cancelled: "🚫 已取消"
  };
  return statusMap[status] || status;
}
let plugin_config_ui = [];
const plugin_init = async (ctx) => {
  try {
    pluginState.init(ctx);
    ctx.logger.info("📚 小说下载插件初始化中...");
    plugin_config_ui = buildConfigSchema(ctx);
    ctx.logger.info("✅ 小说下载插件初始化完成");
    ctx.logger.info(`📁 下载目录: ${pluginState.config.downloadDir}`);
    ctx.logger.info(`⚡ 并发任务数: ${pluginState.config.maxConcurrentTasks}`);
    ctx.logger.info(`🚀 API并发数: ${pluginState.config.apiConcurrency}`);
  } catch (error) {
    ctx.logger.error("❌ 插件初始化失败:", error);
  }
};
const plugin_onmessage = async (ctx, event) => {
  if (event.post_type !== EventType.MESSAGE) return;
  if (!pluginState.config.enabled) return;
  await handleMessage(ctx, event);
};
const plugin_cleanup = async (ctx) => {
  try {
    pluginState.cleanup();
    ctx.logger.info("📚 小说下载插件已卸载");
  } catch (e) {
    ctx.logger.warn("插件卸载时出错:", e);
  }
};
const plugin_get_config = async (ctx) => {
  return pluginState.config;
};
const plugin_set_config = async (ctx, config) => {
  pluginState.replaceConfig(config);
  ctx.logger.info("配置已更新");
};
const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  try {
    pluginState.updateConfig({ [key]: value });
    ctx.logger.debug(`配置项 ${key} 已更新`);
  } catch (err) {
    ctx.logger.error(`更新配置项 ${key} 失败:`, err);
  }
};
export {
  plugin_cleanup,
  plugin_config_ui,
  plugin_get_config,
  plugin_init,
  plugin_on_config_change,
  plugin_onmessage,
  plugin_set_config
};
