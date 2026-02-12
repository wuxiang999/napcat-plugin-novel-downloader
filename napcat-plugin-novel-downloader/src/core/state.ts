import type { NapCatPluginContext } from 'napcat-types';
import type { PluginConfig, UserData, DownloadTask } from '../types';
import { defaultConfig } from '../config';
import fs from 'fs';
import path from 'path';

/**
 * 插件全局状态管理
 */
class PluginState {
  ctx!: NapCatPluginContext;
  config: PluginConfig = { ...defaultConfig };
  
  // 用户数据存储
  private userData: Map<string, UserData> = new Map();
  private userDataPath = '';
  
  // 下载任务管理
  activeDownloads: Map<string, DownloadTask> = new Map();

  /**
   * 初始化状态
   */
  init(ctx: NapCatPluginContext): void {
    this.ctx = ctx;
    this.loadConfig();
    this.loadUserData();
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    try {
      const configPath = path.join(this.ctx.configPath, 'config.json');
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        this.config = { ...defaultConfig, ...JSON.parse(data) };
      } else {
        this.saveConfig();
      }
    } catch (error) {
      this.ctx.logger.error('加载配置失败:', error);
      this.config = { ...defaultConfig };
    }
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    try {
      const configPath = path.join(this.ctx.configPath, 'config.json');
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      this.ctx.logger.error('保存配置失败:', error);
    }
  }

  /**
   * 更新配置（合并）
   */
  updateConfig(partial: Partial<PluginConfig>): void {
    this.config = { ...this.config, ...partial };
    this.saveConfig();
  }

  /**
   * 替换配置（完整替换）
   */
  replaceConfig(config: PluginConfig): void {
    this.config = config;
    this.saveConfig();
  }

  /**
   * 加载用户数据
   */
  private loadUserData(): void {
    try {
      this.userDataPath = path.join(this.ctx.dataPath, 'users.json');
      if (fs.existsSync(this.userDataPath)) {
        const data = fs.readFileSync(this.userDataPath, 'utf-8');
        const parsed = JSON.parse(data);
        this.userData = new Map(Object.entries(parsed));
      }
    } catch (error) {
      this.ctx.logger.error('加载用户数据失败:', error);
    }
  }

  /**
   * 保存用户数据
   */
  private saveUserData(): void {
    try {
      const dir = path.dirname(this.userDataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Object.fromEntries(this.userData);
      fs.writeFileSync(this.userDataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      this.ctx.logger.error('保存用户数据失败:', error);
    }
  }

  /**
   * 获取用户数据
   */
  getUser(userId: string): UserData {
    if (!this.userData.has(userId)) {
      const newUser: UserData = {
        userId,
        downloadCount: 0,
        lastDownloadDate: '',
        isVip: false,
      };
      this.userData.set(userId, newUser);
      this.saveUserData();
    }
    return this.userData.get(userId)!;
  }

  /**
   * 更新用户数据
   */
  updateUser(userId: string, data: Partial<UserData>): void {
    const user = this.getUser(userId);
    Object.assign(user, data);
    this.userData.set(userId, user);
    this.saveUserData();
  }

  /**
   * 检查用户是否可以下载
   */
  canUserDownload(userId: string): { allowed: boolean; reason?: string } {
    // 管理员无限制
    if (this.config.adminQQ.includes(userId)) {
      return { allowed: true };
    }

    const user = this.getUser(userId);
    const today = new Date().toISOString().split('T')[0];

    // 重置每日计数
    if (user.lastDownloadDate !== today) {
      user.downloadCount = 0;
      user.lastDownloadDate = today;
      this.updateUser(userId, user);
    }

    // 检查限制
    const limit = user.isVip ? this.config.vipDailyLimit : this.config.dailyLimit;
    if (user.downloadCount >= limit) {
      return {
        allowed: false,
        reason: `今日下载次数已达上限 (${limit}次)`,
      };
    }

    return { allowed: true };
  }

  /**
   * 增加用户下载计数
   */
  incrementDownloadCount(userId: string): void {
    const user = this.getUser(userId);
    user.downloadCount++;
    this.updateUser(userId, user);
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 取消所有下载任务
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

export const pluginState = new PluginState();
