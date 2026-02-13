import type { NapCatPluginContext } from 'napcat-types';
import type { NovelInfo, ChapterInfo, DownloadStatus, DownloadTask } from '../types';
import { pluginState } from '../core/state';
import { QimaoApiClient } from './qimao-api';
import fs from 'fs';
import path from 'path';

/**
 * 小说下载器
 * 
 * 支持七猫小说的搜索和下载
 * 
 * 七猫小说API实现参考:
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 * 
 * @author LANHU199
 */
export class NovelDownloader {
  private qimaoClient: QimaoApiClient;

  constructor() {
    this.qimaoClient = new QimaoApiClient();
  }

  /**
   * 搜索小说
   */
  async searchNovel(keyword: string): Promise<NovelInfo[]> {
    try {
      const results = await this.qimaoClient.searchBooks(keyword);
      
      return results.map(book => ({
        book_id: book.id,
        book_name: book.title,
        author: book.author,
        source: '七猫',
        status: book.isOver ? '已完结' : '连载中',
      }));
    } catch (error) {
      pluginState.logger.error('搜索失败:', error);
      return [];
    }
  }

  /**
   * 获取书籍详情
   */
  async getBookInfo(bookId: string): Promise<NovelInfo | null> {
    try {
      const book = await this.qimaoClient.fetchBookInfo(bookId);
      if (!book) return null;

      return {
        book_id: book.id,
        book_name: book.title,
        author: book.author,
        source: '七猫',
        status: book.isOver ? '已完结' : '连载中',
        abstract: book.intro,
        word_number: book.wordsNum > 0 ? `${(book.wordsNum / 10000).toFixed(1)}万字` : '',
        thumb_url: book.imgUrl,
        category: book.tags,
      };
    } catch (error) {
      pluginState.logger.error('获取书籍信息失败:', error);
      return null;
    }
  }

  /**
   * 开始下载
   */
  async startDownload(
    ctx: NapCatPluginContext,
    userId: string,
    groupId: string,
    bookId: string,
    onProgress: (status: DownloadStatus) => void
  ): Promise<void> {
    try {
      // 获取书籍信息
      const bookInfo = await this.getBookInfo(bookId);
      if (!bookInfo) {
        throw new Error('无法获取书籍信息');
      }

      // 获取章节列表
      const qimaoChapters = await this.qimaoClient.fetchChapterList(bookId);
      if (qimaoChapters.length === 0) {
        throw new Error('无法获取章节列表');
      }

      const chapters: ChapterInfo[] = qimaoChapters.map((ch, index) => ({
        index,
        item_id: ch.id,
        chapter_id: ch.id,
        title: ch.title,
        downloaded: false,
      }));

      // 检查章节数限制
      if (chapters.length > pluginState.config.maxChapterLimit) {
        throw new Error(`章节数超过限制 (${chapters.length}/${pluginState.config.maxChapterLimit})`);
      }

      // 创建下载任务
      const task: DownloadTask = {
        user_id: userId,
        group_id: groupId,
        book_info: bookInfo,
        status: {
          totalChapters: chapters.length,
          downloadedChapters: 0,
          failedChapters: 0,
          progress: 0,
          status: 'downloading',
          startTime: Date.now(),
          avgSpeed: 0,
          estimatedTime: 0,
        },
        chapters,
        tempFile: '',
        isPaused: false,
        abortController: new AbortController(),
      };

      pluginState.activeDownloads.set(userId, task);

      // 下载章节内容
      await this.downloadChapters(task, bookId);

      // 生成文件
      const filePath = await this.generateFile(task);

      // 上传到群文件
      if (groupId) {
        await this.uploadToGroup(ctx, groupId, filePath, bookInfo.book_name);
      }

      task.status.status = 'completed';
      task.status.endTime = Date.now();
      onProgress(task.status);

      pluginState.activeDownloads.delete(userId);
    } catch (error) {
      pluginState.logger.error('下载失败:', error);
      const task = pluginState.activeDownloads.get(userId);
      if (task) {
        task.status.status = 'failed';
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
  private async downloadChapters(task: DownloadTask, bookId: string): Promise<void> {
    const concurrency = pluginState.config.apiConcurrency;
    const chunks: ChapterInfo[][] = [];
    
    // 分批处理
    for (let i = 0; i < task.chapters.length; i += concurrency) {
      chunks.push(task.chapters.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      if (task.abortController.signal.aborted) {
        throw new Error('下载已取消');
      }

      await Promise.all(
        chunk.map(async (chapter) => {
          try {
            const content = await this.qimaoClient.fetchChapterContent(bookId, chapter.chapter_id!);
            chapter.content = content;
            chapter.downloaded = true;
            
            task.status.downloadedChapters++;
            task.status.progress = (task.status.downloadedChapters / task.status.totalChapters) * 100;
            
            const elapsed = (Date.now() - task.status.startTime) / 1000;
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
  private async generateFile(task: DownloadTask): Promise<string> {
    const dir = pluginState.config.downloadDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const format = pluginState.config.outputFormat;
    const baseName = `${task.book_info.book_name}_${task.book_info.author}`;
    
    let filePath: string;
    
    switch (format) {
      case 'epub':
        filePath = await this.generateEpub(task, dir, baseName);
        break;
      case 'html':
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
  private async generateTxt(task: DownloadTask, dir: string, baseName: string): Promise<string> {
    const filePath = path.join(dir, `${baseName}.txt`);

    let content = `${task.book_info.book_name}\n`;
    content += `作者: ${task.book_info.author}\n`;
    content += `来源: ${task.book_info.source}\n`;
    if (task.book_info.status) content += `状态: ${task.book_info.status}\n`;
    if (task.book_info.word_number) content += `字数: ${task.book_info.word_number}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    for (const chapter of task.chapters) {
      if (chapter.downloaded && chapter.content) {
        content += `\n${chapter.title}\n\n`;
        content += `${chapter.content}\n\n`;
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * 生成 HTML 文件
   */
  private async generateHtml(task: DownloadTask, dir: string, baseName: string): Promise<string> {
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
    
    if (task.book_info.status) html += `\n    <div class="book-meta">状态: ${task.book_info.status}</div>`;
    if (task.book_info.word_number) html += `\n    <div class="book-meta">字数: ${task.book_info.word_number}</div>`;
    if (task.book_info.abstract) html += `\n    <div class="book-meta">简介: ${task.book_info.abstract}</div>`;
    
    html += `\n  </div>\n`;

    for (const chapter of task.chapters) {
      if (chapter.downloaded && chapter.content) {
        const escapedTitle = this.escapeHtml(chapter.title);
        const escapedContent = this.escapeHtml(chapter.content);
        html += `  <div class="chapter">
    <div class="chapter-title">${escapedTitle}</div>
    <div class="chapter-content">${escapedContent}</div>
  </div>\n`;
      }
    }

    html += `</body>\n</html>`;

    fs.writeFileSync(filePath, html, 'utf-8');
    return filePath;
  }

  /**
   * 生成 EPUB 文件
   */
  private async generateEpub(task: DownloadTask, dir: string, baseName: string): Promise<string> {
    // 简化版 EPUB 生成（实际应使用 epub-gen 库）
    // 这里先生成 TXT 格式作为备选
    pluginState.logger.warn('EPUB 格式暂未完全实现，将生成 TXT 格式');
    return await this.generateTxt(task, dir, baseName);
  }

  /**
   * HTML 转义
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * 上传到群文件
   */
  private async uploadToGroup(ctx: NapCatPluginContext, groupId: string, filePath: string, fileName: string): Promise<void> {
    try {
      const ext = path.extname(filePath);
      await ctx.actions.call('upload_group_file', {
        group_id: groupId,
        file: filePath,
        name: `${fileName}${ext}`,
      }, ctx.adapterName, ctx.pluginManager.config);
    } catch (error) {
      pluginState.logger.error('上传群文件失败:', error);
      throw error;
    }
  }
}
