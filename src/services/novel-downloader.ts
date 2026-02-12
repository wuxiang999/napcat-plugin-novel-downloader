import type { NapCatPluginContext } from 'napcat-types';
import type { NovelInfo, ChapterInfo, DownloadStatus, DownloadTask } from '../types';
import { pluginState } from '../core/state';
import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';

/**
 * 小说下载器
 * 
 * 支持七猫小说的搜索和下载
 * 
 * 七猫小说API实现参考:
 * https://github.com/shing-yu/swiftcat-downloader-flutter
 */
export class NovelDownloader {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = this.createAxiosInstance();
  }

  /**
   * 创建 Axios 实例
   */
  private createAxiosInstance(): AxiosInstance {
    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 350,
    });
    const httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 350,
      rejectUnauthorized: false,
    });

    return axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
      },
      httpAgent,
      httpsAgent,
      timeout: 8000,
    });
  }

  /**
   * 搜索小说
   */
  async searchNovel(keyword: string): Promise<NovelInfo[]> {
    try {
      // 使用七猫小说搜索API
      const url = `https://api.qimao.com/search?keyword=${encodeURIComponent(keyword)}&page=1&size=10`;
      
      const response = await this.axiosInstance.get(url);
      const data = response.data;

      if (!data || !data.data || !data.data.list) {
        return [];
      }

      return data.data.list.map((book: any) => ({
        book_id: String(book.bookId || book.id),
        book_name: book.bookName || book.title,
        author: book.authorName || book.author,
        source: '七猫',
        status: book.status,
        abstract: book.intro,
        word_number: book.wordsNum,
      }));
    } catch (error) {
      pluginState.logger.error('搜索失败:', error);
      return [];
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
    platform: string,
    onProgress: (status: DownloadStatus) => void
  ): Promise<void> {
    try {
      // 获取书籍信息
      const bookInfo = await this.getBookInfo(bookId, platform);
      if (!bookInfo) {
        throw new Error('无法获取书籍信息');
      }

      // 获取章节列表
      const chapters = await this.getChapters(bookId, platform);
      if (chapters.length === 0) {
        throw new Error('无法获取章节列表');
      }

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
      await this.downloadChapters(task, bookId, platform);

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
   * 获取书籍信息
   */
  private async getBookInfo(bookId: string, platform: string): Promise<NovelInfo | null> {
    try {
      // 使用七猫小说API
      const url = `https://api.qimao.com/book/info?bookId=${bookId}`;
      const response = await this.axiosInstance.get(url);
      const data = response.data;

      if (!data || !data.data) {
        return null;
      }

      const book = data.data;
      return {
        book_id: bookId,
        book_name: book.bookName || book.title,
        author: book.authorName || book.author,
        source: '七猫',
        status: book.status,
        abstract: book.intro,
      };
    } catch (error) {
      pluginState.logger.error('获取书籍信息失败:', error);
      return null;
    }
  }

  /**
   * 获取章节列表
   */
  private async getChapters(bookId: string, platform: string): Promise<ChapterInfo[]> {
    try {
      const url = `https://api.qimao.com/book/chapters?bookId=${bookId}`;
      const response = await this.axiosInstance.get(url);
      const data = response.data;

      if (!data || !data.data) {
        return [];
      }

      return data.data.map((chapter: any, index: number) => ({
        index,
        item_id: String(chapter.itemId || chapter.id),
        title: chapter.title,
        downloaded: false,
      }));
    } catch (error) {
      pluginState.logger.error('获取章节列表失败:', error);
      return [];
    }
  }

  /**
   * 下载章节内容
   */
  private async downloadChapters(task: DownloadTask, bookId: string, platform: string): Promise<void> {
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
            const content = await this.downloadChapter(bookId, chapter.item_id!, platform);
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
   * 下载单个章节
   */
  private async downloadChapter(bookId: string, chapterId: string, platform: string): Promise<string> {
    try {
      const url = `https://api.qimao.com/chapter/content?bookId=${bookId}&chapterId=${chapterId}`;
      const response = await this.axiosInstance.get(url);
      const data = response.data;

      if (!data || !data.data) {
        throw new Error('章节内容为空');
      }

      return data.data.content || data.data;
    } catch (error) {
      throw new Error(`下载章节失败: ${error}`);
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

    const fileName = `${task.book_info.book_name}_${task.book_info.author}.txt`;
    const filePath = path.join(dir, fileName);

    let content = `${task.book_info.book_name}\n`;
    content += `作者: ${task.book_info.author}\n`;
    content += `来源: ${task.book_info.source}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    for (const chapter of task.chapters) {
      if (chapter.downloaded && chapter.content) {
        content += `\n${chapter.title}\n\n`;
        content += `${chapter.content}\n\n`;
      }
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    task.tempFile = filePath;

    return filePath;
  }

  /**
   * 上传到群文件
   */
  private async uploadToGroup(ctx: NapCatPluginContext, groupId: string, filePath: string, fileName: string): Promise<void> {
    try {
      await ctx.actions.call('upload_group_file', {
        group_id: groupId,
        file: filePath,
        name: `${fileName}.txt`,
      }, ctx.adapterName, ctx.pluginManager.config);
    } catch (error) {
      pluginState.logger.error('上传群文件失败:', error);
      throw error;
    }
  }
}
