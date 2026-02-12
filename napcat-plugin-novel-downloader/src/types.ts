/**
 * 插件配置接口
 */
export interface PluginConfig {
  enabled: boolean;
  adminQQ: string[];
  dailyLimit: number;
  vipDailyLimit: number;
  maxChapterLimit: number;
  downloadDir: string;
  maxConcurrentTasks: number;
  apiConcurrency: number;
  debug: boolean;
}

/**
 * 小说信息接口
 */
export interface NovelInfo {
  book_id: string;
  book_name: string;
  author: string;
  source: string;
  status?: string;
  abstract?: string;
  word_number?: string;
  thumb_url?: string;
  category?: string;
  serial_count?: string;
}

/**
 * 章节信息接口
 */
export interface ChapterInfo {
  index: number;
  item_id?: string;
  chapter_id?: string;
  title: string;
  content?: string;
  downloaded?: boolean;
  retryCount?: number;
  error?: string;
}

/**
 * 下载状态接口
 */
export interface DownloadStatus {
  totalChapters: number;
  downloadedChapters: number;
  failedChapters: number;
  progress: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  avgSpeed: number;
  estimatedTime: number;
  error?: string;
}

/**
 * 下载任务接口
 */
export interface DownloadTask {
  user_id: string;
  group_id: string;
  book_info: NovelInfo;
  status: DownloadStatus;
  chapters: ChapterInfo[];
  tempFile: string;
  isPaused: boolean;
  abortController: AbortController;
}

/**
 * 用户数据接口
 */
export interface UserData {
  userId: string;
  downloadCount: number;
  lastDownloadDate: string;
  isVip: boolean;
  vipExpireAt?: number;
}
